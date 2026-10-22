// "Plan with questions": a short guide that asks about your jobs, regular costs and saving goals,
// works out the monthly amounts, and puts them into the budget. Everything stays editable afterwards.
import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native'
import { useTheme, useStyles, Palette, tabular } from '../../../shared/theme/theme'
import { Button, Field, Segmented, useIsWide } from '../../../shared/ui/ui'
import { formatMoney } from '../../../shared/money/format'
import { parseAmount } from '../../../shared/money/entry'
import { localToday } from '../../../shared/dates'
import { useTransactionStore, loadAllTransactions } from '../../transactions/api'
import { fetchSubscriptions, monthlyAmount } from '../../subscriptions/api'
import {
    Job, Amount, SavingGoal, PlanAnswers, PlanItem, PayType, PayFrequency, Period,
    jobMonthly, toMonthly, goalMonthly, monthsUntil, recentMonthlySpending, buildPlan, planTotals,
    startingAnswers, COMMON_COSTS,
} from '../logic/planner'
import { applyPlan } from '../logic/data'
import { BudgetItem, BudgetType, SECTIONS, SECTION_LABELS, MONTH_NAMES } from '../logic/types'

const STEPS = ['Your income', 'Your regular costs', 'Saving goals', 'Review your plan']
const STEP_INTROS = [
    "Tell us how you get paid and we'll work out what comes in each month.",
    "What do you pay for regularly? We've filled in what's already in your budget. Leave anything blank to skip it.",
    'What are you saving toward? Pick a target and a date and we\'ll work out how much to put away.',
    "Here's your plan, a month at a time. Change any amount before adding it. Anything else in your budget stays as it is.",
]
const money = (n: number) => formatMoney(n)
const blankJob = (): Job => ({ name: '', payType: 'hourly', hourlyRate: '', hoursPerWeek: '', taxPercent: '' })
const PAY_TYPES: { value: PayType; label: string }[] = [{ value: 'hourly', label: 'Hourly' }, { value: 'salary', label: 'Salary' }, { value: 'paycheck', label: 'Per paycheck' }]
const FREQUENCIES: { value: PayFrequency; label: string }[] = [
    { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Every 2 weeks' }, { value: 'semimonthly', label: 'Twice a month' }, { value: 'monthly', label: 'Monthly' },
]
const PERIODS: Period[] = ['week', 'month', 'year']

interface ReviewRow { name: string; type: BudgetType; text: string }

export function PlanGuide({ year, items, amountFor, onClose, onSaved }: {
    year: number
    items: BudgetItem[]
    /** What an existing item is planned at per month right now */
    amountFor: (itemId: string) => number
    onClose: () => void
    onSaved: (result: { added: number; updated: number }) => void
}) {
    const wide = useIsWide()
    const { c: C } = useTheme()
    const s = useStyles(makeStyles)
    const today = localToday()
    const thisYear = +today.slice(0, 4), thisMonth = +today.slice(5, 7)

    const [step, setStep] = useState(0)
    const [answers, setAnswers] = useState<PlanAnswers>(() =>
        startingAnswers(items.map(i => ({ name: i.name, type: i.type, monthly: amountFor(i.id) }))))
    const [review, setReview] = useState<ReviewRow[]>([])
    const [start, setStart] = useState<'from' | 'all'>('from')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Recent spending and subscriptions, for hints on the costs step
    const stored = useTransactionStore(st => st.transactions)
    const [loaded, setLoaded] = useState<any[] | null>(null)
    const [subsMonthly, setSubsMonthly] = useState(0)
    useEffect(() => {
        let live = true
        if (!stored.length) loadAllTransactions().then(t => { if (live && t) setLoaded(t as any[]) }).catch(() => {})
        fetchSubscriptions().then(subs => {
            if (!live) return
            const total = subs.filter(x => x.type === 'expense' && x.status === 'active').reduce((n, x) => n + monthlyAmount(x), 0)
            setSubsMonthly(Math.round(total * 100) / 100)
        }).catch(() => {})
        return () => { live = false }
    }, [])
    const transactions = stored.length ? stored : loaded ?? []
    const recent = (name: string) => recentMonthlySpending(transactions as any, name, today)

    const income = useMemo(() => answers.jobs.reduce((n, j) => n + jobMonthly(j), 0)
        + answers.otherIncome.reduce((n, o) => n + toMonthly(o.amount, o.period), 0), [answers])

    const set = <K extends keyof PlanAnswers>(key: K, list: PlanAnswers[K]) => setAnswers(a => ({ ...a, [key]: list }))
    const update = <K extends keyof PlanAnswers>(key: K, i: number, patch: Partial<PlanAnswers[K][number]>) =>
        setAnswers(a => ({ ...a, [key]: (a[key] as any[]).map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
    const remove = <K extends keyof PlanAnswers>(key: K, i: number) =>
        setAnswers(a => ({ ...a, [key]: (a[key] as any[]).filter((_, j) => j !== i) }))

    function next() {
        if (step === 2) setReview(buildPlan(answers, today).map(i => ({ name: i.name, type: i.type, text: String(i.monthly) })))
        setStep(step + 1)
    }

    const reviewItems: PlanItem[] = review
        .map(r => ({ name: r.name, type: r.type, monthly: Math.abs(parseAmount(r.text) ?? 0) }))
        .filter(r => r.monthly > 0)
    // What's already in the budget and isn't part of the plan stays as it is, so it still counts
    const untouched: PlanItem[] = items
        .filter(i => !reviewItems.some(r => r.type === i.type && r.name.trim().toLowerCase() === i.name.trim().toLowerCase()))
        .map(i => ({ name: i.name, type: i.type, monthly: amountFor(i.id) }))
        .filter(i => i.monthly > 0)
    const totals = planTotals([...reviewItems, ...untouched])
    const canStartLater = year === thisYear && thisMonth > 1
    const fromMonth = canStartLater && start === 'from' ? thisMonth : 1

    async function save() {
        setSaving(true)
        setError(null)
        try {
            const result = await applyPlan({ year, fromMonth, items: reviewItems, existing: items })
            onSaved(result)
        } catch (e: any) {
            setError(e?.message ?? "Couldn't save your plan")
            setSaving(false)
        }
    }

    // ---- Step 1: income ----
    const jobCount = answers.jobs.length
    const setJobCount = (n: number) => set('jobs', Array.from({ length: n }, (_, i) => answers.jobs[i] ?? blankJob()))
    const incomeNames = items.filter(i => i.type === 'income').map(i => i.name)

    const incomeStep = (
        <View>
            <Text style={s.question}>How many jobs do you have?</Text>
            <Segmented<string>
                value={String(Math.min(jobCount, 3))}
                onChange={v => setJobCount(+v)}
                options={[{ value: '0', label: 'None' }, { value: '1', label: '1 job' }, { value: '2', label: '2 jobs' }, { value: '3', label: '3 jobs' }]}
                style={{ marginBottom: 14 }}
            />
            {answers.jobs.map((job, i) => {
                const many = jobCount > 1
                const label = (l: string) => (many ? `Job ${i + 1}: ${l.toLowerCase()}` : l)
                const monthly = jobMonthly(job)
                return (
                    <View key={i} style={s.card}>
                        <Field label={`Job ${i + 1} name`} value={job.name} placeholder="e.g. Cafe" onChangeText={name => update('jobs', i, { name })} />
                        {!!incomeNames.length && !job.name && (
                            <View style={[s.chips, { marginTop: -6, marginBottom: 12 }]}>
                                {incomeNames.map(n => <SmallChoice key={n} label={n} a11y={`Call job ${i + 1} ${n}`} onPress={() => update('jobs', i, { name: n })} />)}
                            </View>
                        )}
                        <Text style={s.label}>How are you paid?</Text>
                        <Segmented<PayType> value={job.payType} onChange={payType => update('jobs', i, { payType })} options={PAY_TYPES} style={{ marginBottom: 12 }} />
                        {job.payType === 'hourly' && (
                            <View style={s.pair}>
                                <View style={s.half}><Field label="Hourly rate" accessibilityLabel={label('Hourly rate')} keyboardType="decimal-pad" placeholder="$0.00" value={job.hourlyRate ?? ''} onChangeText={hourlyRate => update('jobs', i, { hourlyRate })} /></View>
                                <View style={s.half}><Field label="Hours a week" accessibilityLabel={label('Hours a week')} keyboardType="decimal-pad" placeholder="0" value={job.hoursPerWeek ?? ''} onChangeText={hoursPerWeek => update('jobs', i, { hoursPerWeek })} /></View>
                            </View>
                        )}
                        {job.payType === 'salary' && (
                            <Field label="Salary per year" accessibilityLabel={label('Salary per year')} keyboardType="decimal-pad" placeholder="$0" value={job.salary ?? ''} onChangeText={salary => update('jobs', i, { salary })} />
                        )}
                        {job.payType === 'paycheck' && (
                            <>
                                <Field label="Amount per paycheck" accessibilityLabel={label('Amount per paycheck')} keyboardType="decimal-pad" placeholder="$0.00" value={job.paycheck ?? ''} onChangeText={paycheck => update('jobs', i, { paycheck })} />
                                <Text style={s.label}>How often?</Text>
                                <Segmented<PayFrequency> value={job.paycheckFrequency ?? 'biweekly'} onChange={paycheckFrequency => update('jobs', i, { paycheckFrequency })} options={FREQUENCIES} style={{ marginBottom: 12 }} />
                            </>
                        )}
                        <Field
                            label="Taken out for taxes (%)" accessibilityLabel={label('Taken out for taxes (%)')} keyboardType="decimal-pad" placeholder="0"
                            value={job.taxPercent} onChangeText={taxPercent => update('jobs', i, { taxPercent })}
                            hint={job.payType === 'paycheck' ? 'Leave blank if that is what lands in your account.' : 'A rough guess is fine, often 10 to 25%. Leave blank if the amount above is already take-home.'}
                        />
                        {monthly > 0 && <Text style={[s.result, { color: C.good }]}>About {money(monthly)} a month take-home</Text>}
                    </View>
                )
            })}
            {jobCount >= 3 && <Button small variant="secondary" label="+ Another job" onPress={() => set('jobs', [...answers.jobs, blankJob()])} style={{ alignSelf: 'flex-start', marginBottom: 14 }} />}

            <Text style={[s.question, { marginTop: 8 }]}>Any other money coming in?</Text>
            <Text style={s.help}>Side gigs, an allowance, benefits, child support…</Text>
            {answers.otherIncome.map((o, i) => (
                <AmountRow key={i} row={o} named fallback="Other income" s={s}
                    onChange={patch => update('otherIncome', i, patch)} onRemove={() => remove('otherIncome', i)} />
            ))}
            <Button small variant="secondary" label="+ Other income" onPress={() => set('otherIncome', [...answers.otherIncome, { name: '', amount: '', period: 'month' }])} style={{ alignSelf: 'flex-start' }} />
            {income > 0 && <Text style={[s.total, { color: C.good }]}>Coming in: {money(income)} a month</Text>}
        </View>
    )

    // ---- Step 2: regular costs ----
    const have = (name: string) => answers.costs.some(c => c.name.trim().toLowerCase() === name.toLowerCase())
    const addCost = (name: string) => {
        const amount = name === 'Subscriptions' && subsMonthly > 0 ? String(subsMonthly) : ''
        set('costs', [...answers.costs, { name, amount, period: 'month' }])
    }
    const costsStep = (
        <View>
            {answers.costs.map((c, i) => {
                const lately = c.name.trim() ? recent(c.name) : 0
                return (
                    <AmountRow key={i} row={c} named={!!(c as any)._custom} fallback={`Cost ${i + 1}`} s={s}
                        onChange={patch => update('costs', i, patch)} onRemove={() => remove('costs', i)}
                        extra={lately > 0 ? (
                            <View style={s.lately}>
                                <Text style={s.help}>You've spent about {money(lately)} a month on this lately</Text>
                                <Button small variant="ghost" label="Use it" accessibilityLabel={`Use ${money(lately)} for ${c.name}`} onPress={() => update('costs', i, { amount: String(lately), period: 'month' })} />
                            </View>
                        ) : c.name === 'Subscriptions' && subsMonthly > 0 ? <Text style={s.help}>Your subscriptions list adds up to {money(subsMonthly)} a month</Text> : null}
                    />
                )
            })}
            <Text style={[s.label, { marginTop: 6 }]}>Add more</Text>
            <View style={s.chips}>
                {COMMON_COSTS.filter(n => !have(n)).map(n => <SmallChoice key={n} label={`+ ${n}`} a11y={`Add ${n}`} onPress={() => addCost(n)} />)}
                <SmallChoice label="+ Something else" a11y="Add your own cost" onPress={() => set('costs', [...answers.costs, { name: '', amount: '', period: 'month', _custom: true } as Amount])} />
            </View>
            <Text style={[s.total, { color: C.bad }]}>Going out: {money(answers.costs.reduce((n, c) => n + toMonthly(c.amount, c.period), 0))} a month</Text>
        </View>
    )

    // ---- Step 3: saving goals and investing ----
    const addGoal = (goal: SavingGoal) => set('goals', [...answers.goals, goal])
    const savingStep = (
        <View>
            {answers.goals.map((g, i) => (
                <GoalCard key={i} goal={g} today={today} income={income} s={s} C={C}
                    onChange={patch => update('goals', i, patch)} onRemove={() => remove('goals', i)} />
            ))}
            <View style={[s.chips, { marginBottom: 18 }]}>
                {!answers.goals.some(g => /retire/i.test(g.name)) && <SmallChoice label="+ Retirement" a11y="Add Retirement" onPress={() => addGoal({ name: 'Retirement', kind: 'percent', percent: '' })} />}
                {!answers.goals.some(g => /vacation|travel/i.test(g.name)) && <SmallChoice label="+ Vacation" a11y="Add Vacation" onPress={() => addGoal({ name: 'Vacation', kind: 'target', target: '', saved: '', by: '' })} />}
                <SmallChoice label="+ Another goal" a11y="Add another goal" onPress={() => addGoal({ name: '', kind: 'target', target: '', saved: '', by: '' })} />
            </View>

            <Text style={s.question}>Do you invest each month?</Text>
            <Text style={s.help}>Index funds, stocks, crypto: anything you put money into to grow.</Text>
            {answers.investing.map((v, i) => (
                <AmountRow key={i} row={v} named fallback="Investing" s={s}
                    onChange={patch => update('investing', i, patch)} onRemove={() => remove('investing', i)} />
            ))}
            <Button small variant="secondary" label="+ Investing" onPress={() => set('investing', [...answers.investing, { name: 'Investing', amount: '', period: 'month' }])} style={{ alignSelf: 'flex-start' }} />
        </View>
    )

    // ---- Step 4: review ----
    const reviewStep = (
        <View>
            {SECTIONS.map(type => {
                const rows = review.map((r, i) => ({ r, i })).filter(x => x.r.type === type)
                if (!rows.length) return null
                return (
                    <View key={type} style={{ marginBottom: 14 }}>
                        <Text style={s.sectionTitle}>{SECTION_LABELS[type].title}</Text>
                        {rows.map(({ r, i }) => (
                            <View key={i} style={s.reviewRow}>
                                <Text style={s.reviewName} numberOfLines={1}>{r.name}</Text>
                                <Text style={s.dollar}>$</Text>
                                <TextInput
                                    accessibilityLabel={`${r.name} per month`} value={r.text} keyboardType="decimal-pad"
                                    onChangeText={text => setReview(list => list.map((x, j) => (j === i ? { ...x, text } : x)))}
                                    style={[s.reviewInput, tabular]}
                                />
                                <Text style={s.perMonth}>/mo</Text>
                                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Leave out ${r.name}`} onPress={() => setReview(list => list.filter((_, j) => j !== i))} style={s.x}>
                                    <Text style={s.xText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )
            })}
            {!review.length && <Text style={s.help}>Nothing to add yet. Go back and fill in a few amounts.</Text>}
            {!!untouched.length && (
                <View style={{ marginBottom: 14 }}>
                    <Text style={s.sectionTitle}>Already in your budget, staying as they are</Text>
                    {untouched.map(u => (
                        <View key={u.type + u.name} style={s.keptRow}>
                            <Text style={s.keptName} numberOfLines={1}>{u.name}</Text>
                            <Text style={[s.keptAmount, tabular]}>{u.type === 'income' ? '+' : '-'}{money(u.monthly)}/mo</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={s.totals}>
                <TotalLine label="Coming in" value={totals.income} color={C.good} s={s} />
                <TotalLine label="Spending" value={totals.spending} color={C.bad} s={s} />
                <TotalLine label="Saving and investing" value={totals.saving + totals.investing} color={C.saved} s={s} />
                <View style={[s.totalLine, s.leftLine]}>
                    <Text style={s.leftLabel}>Left over each month</Text>
                    <Text style={[s.leftValue, tabular, { color: totals.left < 0 ? C.bad : C.good }]}>{money(totals.left)}</Text>
                </View>
                {totals.left < 0 && (
                    <Text style={[s.warn, { color: C.bad }]}>
                        You're planning {money(-totals.left)} a month more than comes in. Lower a cost or a goal, or add income.
                    </Text>
                )}
            </View>

            {canStartLater && (
                <View style={{ marginTop: 14 }}>
                    <Text style={s.label}>Put it in your budget for</Text>
                    <Segmented<'from' | 'all'> value={start} onChange={setStart}
                        options={[{ value: 'from', label: `${MONTH_NAMES[thisMonth - 1]} to December` }, { value: 'all', label: `All of ${year}` }]} />
                    <Text style={[s.help, { marginTop: 6 }]}>
                        {start === 'from' ? 'Earlier months keep what they had, so past months still match what really happened.' : 'Every month of the year gets these amounts.'}
                    </Text>
                </View>
            )}
            {error && <Text style={[s.warn, { color: C.bad }]}>{error}</Text>}
        </View>
    )

    const body = [incomeStep, costsStep, savingStep, reviewStep][step]

    return (
        <Modal visible transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
            <View style={[s.overlay, !wide && s.overlayPhone]}>
                <View style={[s.modal, !wide && s.modalPhone]}>
                    <View style={s.header}>
                        <View style={{ flexShrink: 1 }}>
                            <Text style={s.stepCount}>Step {step + 1} of {STEPS.length}</Text>
                            <Text style={s.title} accessibilityRole="header">{STEPS[step]}</Text>
                        </View>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={s.x}>
                            <Text style={[s.xText, { fontSize: 18 }]}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={s.progress}>
                        {STEPS.map((_, i) => <View key={i} style={[s.progressBit, i <= step && { backgroundColor: C.primary }]} />)}
                    </View>
                    <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
                        <Text style={s.intro}>{STEP_INTROS[step]}</Text>
                        {body}
                    </ScrollView>
                    <View style={s.footer}>
                        {step > 0 ? <Button variant="secondary" label="Back" onPress={() => setStep(step - 1)} /> : <View />}
                        {step < STEPS.length - 1
                            ? <Button label="Next" onPress={next} />
                            : <Button label="Add to my budget" onPress={save} loading={saving} disabled={!reviewItems.length} />}
                    </View>
                </View>
            </View>
        </Modal>
    )
}

type Styles = ReturnType<typeof makeStyles>

/** A small "+ Groceries" style button. */
function SmallChoice({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
    const s = useStyles(makeStyles)
    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={s.choice}>
            <Text style={s.choiceText}>{label}</Text>
        </TouchableOpacity>
    )
}

/** A name, an amount, and whether it's per week, month or year. */
function AmountRow({ row, named, fallback, onChange, onRemove, extra, s }: {
    row: Amount
    named?: boolean
    fallback: string
    onChange: (patch: Partial<Amount>) => void
    onRemove: () => void
    extra?: React.ReactNode
    s: Styles
}) {
    const { c: C } = useTheme()
    const name = row.name.trim() || fallback
    const monthly = toMonthly(row.amount, row.period)
    return (
        <View style={s.row}>
            <View style={s.rowTop}>
                {named
                    ? <TextInput accessibilityLabel={`${fallback} name`} placeholder="Name" placeholderTextColor={C.faint} value={row.name} onChangeText={v => onChange({ name: v })} style={[s.input, s.nameInput]} />
                    : <Text style={s.rowName} numberOfLines={1}>{row.name}</Text>}
                <TextInput accessibilityLabel={`${name} amount`} placeholder="$0" placeholderTextColor={C.faint} keyboardType="decimal-pad"
                    value={row.amount} onChangeText={v => onChange({ amount: v })} style={[s.input, s.amountInput, tabular]} />
                <View style={s.periods}>
                    {PERIODS.map(p => (
                        <TouchableOpacity key={p} accessibilityRole="button" accessibilityLabel={`${name} per ${p}`} accessibilityState={{ selected: row.period === p }}
                            onPress={() => onChange({ period: p })} style={[s.period, row.period === p && s.periodOn]}>
                            <Text style={[s.periodText, row.period === p && s.periodTextOn]}>/{p === 'month' ? 'mo' : p === 'week' ? 'wk' : 'yr'}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${name}`} onPress={onRemove} style={s.x}>
                    <Text style={s.xText}>✕</Text>
                </TouchableOpacity>
            </View>
            {row.period !== 'month' && monthly > 0 && <Text style={s.help}>{money(monthly)} a month</Text>}
            {extra}
        </View>
    )
}

/** One saving goal: a target by a date, a fixed amount, or a share of your pay. */
function GoalCard({ goal, today, income, onChange, onRemove, s, C }: {
    goal: SavingGoal; today: string; income: number
    onChange: (patch: Partial<SavingGoal>) => void
    onRemove: () => void
    s: Styles; C: Palette
}) {
    const name = goal.name.trim() || 'Goal'
    const l = (x: string) => `${name}: ${x}`
    const monthly = goalMonthly(goal, today, income)
    return (
        <View style={s.card}>
            <View style={s.rowTop}>
                <TextInput accessibilityLabel={l('name')} placeholder="What are you saving for?" placeholderTextColor={C.faint} value={goal.name}
                    onChangeText={v => onChange({ name: v })} style={[s.input, s.nameInput, s.goalName]} />
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${name}`} onPress={onRemove} style={s.x}>
                    <Text style={s.xText}>✕</Text>
                </TouchableOpacity>
            </View>
            <Segmented<SavingGoal['kind']> value={goal.kind} onChange={kind => onChange({ kind })} style={{ marginVertical: 10 }}
                options={[{ value: 'target', label: 'Reach a target' }, { value: 'monthly', label: 'Set amount' }, { value: 'percent', label: '% of pay' }]} />
            {goal.kind === 'target' && (
                <>
                    <View style={s.pair}>
                        <View style={s.half}><Field label="How much you want saved" accessibilityLabel={l('how much you want saved')} keyboardType="decimal-pad" placeholder="$0" value={goal.target ?? ''} onChangeText={v => onChange({ target: v })} /></View>
                        <View style={s.half}><Field label="Already saved" accessibilityLabel={l('already saved')} keyboardType="decimal-pad" placeholder="$0" value={goal.saved ?? ''} onChangeText={v => onChange({ saved: v })} /></View>
                    </View>
                    <Field label="By when (YYYY-MM)" accessibilityLabel={l('by when (YYYY-MM)')} placeholder={`${+today.slice(0, 4) + 1}-${today.slice(5, 7)}`} value={goal.by ?? ''} onChangeText={v => onChange({ by: v })}
                        hint="Leave blank to save it all this month." />
                    {monthly > 0 && <Text style={[s.result, { color: C.saved }]}>{money(monthly)} a month for {monthsUntil(goal.by ?? '', today)} months</Text>}
                </>
            )}
            {goal.kind === 'monthly' && (
                <Field label="Each month" accessibilityLabel={l('each month')} keyboardType="decimal-pad" placeholder="$0" value={goal.monthly ?? ''} onChangeText={v => onChange({ monthly: v })} />
            )}
            {goal.kind === 'percent' && (
                <>
                    <Field label="Percent of take-home pay" accessibilityLabel={l('percent of take-home pay')} keyboardType="decimal-pad" placeholder="e.g. 5" value={goal.percent ?? ''} onChangeText={v => onChange({ percent: v })}
                        hint={income > 0 ? undefined : 'Fill in your income on step 1 to work this out.'} />
                    {monthly > 0 && <Text style={[s.result, { color: C.saved }]}>{money(monthly)} a month</Text>}
                </>
            )}
        </View>
    )
}

function TotalLine({ label, value, color, s }: { label: string; value: number; color: string; s: Styles }) {
    return (
        <View style={s.totalLine}>
            <Text style={s.totalLabel}>{label}</Text>
            <Text style={[s.totalValue, tabular, { color }]}>{money(value)}</Text>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', alignItems: 'center', padding: 16 },
    overlayPhone: { padding: 0, justifyContent: 'flex-end' },
    modal: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, width: '100%', maxWidth: 640, maxHeight: '92%' },
    modalPhone: { flex: 1, maxHeight: '100%', borderRadius: 0, borderWidth: 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
    stepCount: { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
    title: { fontSize: 21, fontWeight: '700', color: C.ink, marginTop: 2 },
    progress: { flexDirection: 'row', gap: 4, paddingHorizontal: 20, paddingBottom: 12 },
    progressBit: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.track },
    body: { flexGrow: 0, flexShrink: 1, borderTopWidth: 1, borderColor: C.line },
    bodyContent: { padding: 20 },
    intro: { fontSize: 14, color: C.text, lineHeight: 20, marginBottom: 16 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: C.line },
    question: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 8 },
    label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
    help: { fontSize: 12.5, color: C.muted, lineHeight: 18, marginBottom: 6 },
    card: { backgroundColor: C.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 14, marginBottom: 12 },
    pair: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    half: { flex: 1, minWidth: 130 },
    result: { fontSize: 15, fontWeight: '700' },
    total: { fontSize: 14, fontWeight: '700', marginTop: 14 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    choice: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', backgroundColor: C.surface },
    choiceText: { fontSize: 13, color: C.primary, fontWeight: '600' },
    row: { paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowName: { flex: 1, fontSize: 15, fontWeight: '600', color: C.ink },
    input: { backgroundColor: C.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: C.ink },
    nameInput: { flex: 1, minWidth: 0 },
    goalName: { fontWeight: '600', backgroundColor: C.surface },
    amountInput: { width: 92, textAlign: 'right' },
    periods: { flexDirection: 'row', backgroundColor: C.track, borderRadius: 8, padding: 2 },
    period: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 6 },
    periodOn: { backgroundColor: C.surface },
    periodText: { fontSize: 12, color: C.muted, fontWeight: '600' },
    periodTextOn: { color: C.ink },
    lately: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 },
    x: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
    xText: { fontSize: 14, color: C.muted },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
    reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderColor: C.line },
    reviewName: { flex: 1, fontSize: 15, color: C.ink },
    dollar: { fontSize: 15, color: C.muted },
    reviewInput: { width: 96, textAlign: 'right', fontSize: 15, color: C.ink, backgroundColor: C.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: C.line, paddingHorizontal: 8, paddingVertical: 6 },
    perMonth: { fontSize: 12, color: C.muted, width: 28 },
    keptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    keptName: { flex: 1, fontSize: 14, color: C.muted },
    keptAmount: { fontSize: 14, color: C.muted },
    totals: { backgroundColor: C.surfaceAlt, borderRadius: 12, padding: 14, gap: 6, marginTop: 4 },
    totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    totalLabel: { fontSize: 14, color: C.text },
    totalValue: { fontSize: 15, fontWeight: '600' },
    leftLine: { borderTopWidth: 1, borderColor: C.line, paddingTop: 8, marginTop: 2 },
    leftLabel: { fontSize: 15, fontWeight: '700', color: C.ink },
    leftValue: { fontSize: 20, fontWeight: '800' },
    warn: { fontSize: 13, lineHeight: 18, marginTop: 6, fontWeight: '600' },
})
