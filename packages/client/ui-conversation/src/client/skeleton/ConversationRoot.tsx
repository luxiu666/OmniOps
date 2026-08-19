// Resident conversation skeleton. Hero chrome, composer positioning, the
// chain, AND the composer bar (session-maybe slot) stay mounted across
// no-session/session transitions — the bar renders inert via owner props.

import { useCallback, useRef, useState } from 'react'
import clsx from 'clsx'
import type { ConversationSlotProps, InputZone } from '../contract/slots.ts'
import { HeroGlow, HeroShell } from './EmptyHero.tsx'
import css from './ConversationRoot.module.css'

/** Full props composed from the slot contract. */
export type ConversationRootProps = ConversationSlotProps

/** 诊断技能类型。 */
interface SkillOption { readonly id: string; readonly label: string }
/** 组件选项：属于某个技术栈，带该组件可用的诊断技能。 */
interface ComponentOption { readonly id: string; readonly label: string; readonly skills: readonly SkillOption[] }
/** 技术栈选项：决定组件列表。 */
interface TechStackOption { readonly id: string; readonly label: string; readonly components: readonly ComponentOption[] }

/**
 * 首页诊断范围的三级目录：技术栈 → 组件 → 诊断技能。
 * 下拉框按此联动：选技术栈刷新组件列表，选组件刷新诊断技能列表。
 * 维护方式：新增/调整诊断能力只改这里即可（映射表同步见 docs/cookbook/editing-web-copy-and-fonts.zh.md）。
 */
const TECH_STACKS = [
  {
    id: 'database',
    label: '数据库',
    components: [
      {
        id: 'mysql',
        label: 'MySQL',
        skills: [
          { id: 'slow-query', label: '慢查询分析' },
          { id: 'lock-wait', label: '锁等待分析' },
          { id: 'connection-pool', label: '连接池分析' },
          { id: 'deadlock', label: '死锁检测' },
        ],
      },
      {
        id: 'redis',
        label: 'Redis',
        skills: [
          { id: 'slow-query', label: '慢查询分析' },
          { id: 'big-key', label: '大 Key 分析' },
          { id: 'memory', label: '内存分析' },
          { id: 'connection', label: '连接数分析' },
        ],
      },
      {
        id: 'mongodb',
        label: 'MongoDB',
        skills: [
          { id: 'slow-query', label: '慢查询分析' },
          { id: 'index', label: '索引分析' },
          { id: 'lock-wait', label: '锁等待分析' },
        ],
      },
    ],
  },
  {
    id: 'compute',
    label: '计算资源',
    components: [
      {
        id: 'gpu',
        label: 'GPU',
        skills: [
          { id: 'utilization', label: '利用率分析' },
          { id: 'vram', label: '显存分析' },
          { id: 'drop', label: '掉卡检测' },
        ],
      },
      {
        id: 'cpu',
        label: 'CPU',
        skills: [
          { id: 'utilization', label: '利用率分析' },
          { id: 'load', label: '负载分析' },
          { id: 'context-switch', label: '上下文切换分析' },
        ],
      },
      {
        id: 'npu',
        label: 'NPU',
        skills: [
          { id: 'utilization', label: '利用率分析' },
          { id: 'hbm', label: 'HBM 显存分析' },
          { id: 'drop', label: '掉卡检测' },
        ],
      },
    ],
  },
  {
    id: 'middleware',
    label: '中间件',
    components: [
      {
        id: 'kafka',
        label: 'Kafka',
        skills: [
          { id: 'backlog', label: '消息堆积分析' },
          { id: 'consumer-lag', label: '消费者 Lag 分析' },
          { id: 'partition', label: '分区倾斜分析' },
        ],
      },
      {
        id: 'rabbitmq',
        label: 'RabbitMQ',
        skills: [
          { id: 'backlog', label: '消息堆积分析' },
          { id: 'connection', label: '连接分析' },
          { id: 'memory', label: '内存分析' },
        ],
      },
      {
        id: 'nginx',
        label: 'Nginx',
        skills: [
          { id: 'connection', label: '连接分析' },
          { id: 'throughput', label: '吞吐分析' },
          { id: 'upstream', label: '上游超时分析' },
        ],
      },
      {
        id: 'zookeeper',
        label: 'Zookeeper',
        skills: [
          { id: 'session', label: '会话分析' },
          { id: 'election', label: '选举分析' },
          { id: 'latency', label: '延迟分析' },
        ],
      },
    ],
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    components: [
      {
        id: 'node',
        label: 'Node',
        skills: [
          { id: 'watermark', label: '资源水位分析' },
          { id: 'notready', label: '节点异常检测' },
        ],
      },
      {
        id: 'pod',
        label: 'Pod',
        skills: [
          { id: 'oom', label: 'OOM 分析' },
          { id: 'restart', label: '重启分析' },
          { id: 'schedule', label: '调度分析' },
        ],
      },
      {
        id: 'deployment',
        label: 'Deployment',
        skills: [
          { id: 'rollout-fail', label: '发布失败分析' },
          { id: 'rollout', label: '滚动更新分析' },
        ],
      },
      {
        id: 'service',
        label: 'Service',
        skills: [
          { id: 'connection', label: '连接分析' },
          { id: 'dns', label: 'DNS 解析分析' },
          { id: 'loadbalance', label: '负载均衡分析' },
        ],
      },
    ],
  },
] as const satisfies readonly TechStackOption[]

export function ConversationRoot({
  sessionId, useSession, useSessions, useInput, useComposerBlock,
  renderSlot, renderSlotChain, t,
}: ConversationRootProps) {
  const openState = useSession(s => s.openState)
  const composerPhase = useSession(s => s.composerPhase)
  const pending = useSession(s => s.pending) ?? []
  const session = useSession(s => s)
  const inputState = useInput(s => s)
  const summaryBlank = useSessions(s => sessionId === undefined ? undefined : s.byId[sessionId]?.blank)
  // A plugin this package cannot import (ui-model-selection) says this session cannot
  // send; its reason is already localized by whoever raised it.
  const composerBlock = useComposerBlock(block => block)

  const [techStackId, setTechStackId] = useState<string>(TECH_STACKS[0].id)
  const [componentId, setComponentId] = useState<string>(TECH_STACKS[0].components[0].id)
  const [skillId, setSkillId] = useState<string>(TECH_STACKS[0].components[0].skills[0].id)

  // 当前技术栈与其组件列表（按选中项派生；状态短暂不一致时回退到首项）。
  const techStack = TECH_STACKS.find(s => s.id === techStackId) ?? TECH_STACKS[0]
  const component = techStack.components.find(c => c.id === componentId) ?? techStack.components[0]

  // 切换技术栈：组件重置为该技术栈下的第一个，诊断技能随之重置。
  const pickTechStack = (id: string): void => {
    const stack = TECH_STACKS.find(s => s.id === id) ?? TECH_STACKS[0]
    setTechStackId(stack.id)
    setComponentId(stack.components[0].id)
    setSkillId(stack.components[0].skills[0].id)
  }
  // 切换组件：诊断技能重置为该组件下的第一个。
  const pickComponent = (id: string): void => {
    const comp = techStack.components.find(c => c.id === id) ?? techStack.components[0]
    setComponentId(comp.id)
    setSkillId(comp.skills[0].id)
  }

  // Publishes the seat's live height as --dsh-composer-height on the scroll
  // body so floating controls (ChatView back-to-bottom) clear the composer as
  // it grows. Callback ref, not an effect; stable identity prevents observer
  // churn while the first blank session fills the resident body outlet.
  const seatObserver = useRef<ResizeObserver | null>(null)
  const seatResizeRef = useCallback((seat: HTMLDivElement | null): void => {
    seatObserver.current?.disconnect()
    seatObserver.current = null
    const scroller = seat?.parentElement ?? null
    if (seat === null || scroller === null) return
    seatObserver.current = new ResizeObserver(() => {
      scroller.style.setProperty('--dsh-composer-height', `${seat.offsetHeight}px`)
    })
    seatObserver.current.observe(seat)
  }, [])

  // While a session is still replaying (loading + blank) the hero/docked
  // choice is unknowable — render the composer hidden instead of flashing
  // the centered hero and snapping to the docked bar (or vice versa).
  const settling = sessionId !== undefined && composerPhase === 'blank' && openState === 'loading'
    && summaryBlank !== true
  const hero = sessionId === undefined
    || (composerPhase === 'blank' && (openState === 'open' || summaryBlank === true))
  const zone: InputZone | undefined =
    session === undefined || inputState === undefined ? undefined : { session, input: inputState }

  const heroWorkspaceRow = (
    <div className={css.heroWorkspaceRow}>
      <label className={css.heroSelect}>
        <span className={css.heroSelectLabel}>技术栈</span>
        <select value={techStackId} onChange={e => pickTechStack(e.target.value)}>
          {TECH_STACKS.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className={css.heroSelect}>
        <span className={css.heroSelectLabel}>组件</span>
        <select value={componentId} onChange={e => pickComponent(e.target.value)}>
          {techStack.components.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className={css.heroSelect}>
        <span className={css.heroSelectLabel}>诊断</span>
        <select value={skillId} onChange={e => setSkillId(e.target.value)}>
          {component.skills.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
    </div>
  )

  const blocked = composerBlock !== undefined
  const inputBar = renderSlot('conversation.composer.bar', {
    variant: hero ? 'hero' : 'composer',
    ...(blocked
      ? { blocked: composerBlock, placeholder: composerBlock.reason }
      : hero ? { placeholder: t('placeholder.hero') } : {}),
    overlay: renderSlot('conversation.input.overlay', {}),
    leftItems: zone === undefined ? null : renderSlot('conversation.input.left', zone),
    rightItems: zone === undefined ? null : renderSlot('conversation.input.right', zone),
    // Stats band under the card, inside the bar's width column so both
    // share one constraint (composer.dock = stats-line family).
    footer: !hero && zone !== undefined ? renderSlot('conversation.composer.dock', zone) : null,
  })

  const composerBar = (
    <div className={clsx(css.composerStack, hero && css.composerHero)}>
      {hero && <HeroGlow className={css.heroGlow} />}
      {hero && <HeroShell t={t} />}
      {hero && heroWorkspaceRow}
      {zone !== undefined && renderSlot('conversation.input.dock', zone)}
      {inputBar}
    </div>
  )

  const phase = settling ? 'settling' : hero ? 'hero' : 'active'
  const composer = renderSlotChain(
    'conversation.composer',
    { interactions: pending, session },
    { fallback: composerBar, overlay: true },
  )

  // Sticky wraps the whole chain output (fallback + elected overlay), not
  // only `.composerStack`: overlay:true renders those as siblings, and sticky
  // on the fallback alone would leave Question/Approval panels at the content
  // end off-screen when the user is not pinned to the floor.
  const composerSeat = (
    <div ref={seatResizeRef} className={css.composerSeat} data-composer-seat="">
      {composer}
    </div>
  )

  return (
    <div className={css.root} data-phase={phase}>
      {renderSlot('conversation.session.header', {})}
      <div className={css.scrollBody} data-conversation-scroll="">
        {renderSlot('conversation.session', {})}
        {composerSeat}
      </div>
    </div>
  )
}
