import { ScrollView, View, StyleSheet, useWindowDimensions } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useDashboardLogic } from '../logic/useDashboardLogic'
import { PeriodHeader } from './PeriodHeader'
import { SpendingSummary } from './SpendingSummary'
import { AccountsRow } from './AccountsRow'
import { BudgetList } from './BudgetList'
import { MonthlyTrend } from './MonthlyTrend'
import { ActivityList } from './ActivityList'
import { useStyles, useTheme, Palette } from '../../../shared/theme/theme'

const WIDE = 900

export default function Dashboard() {
    const styles = useStyles(makeStyles)
    const { backdrop } = useTheme()
    const logic = useDashboardLogic()
    const navigation = useNavigation<any>()
    const { width } = useWindowDimensions()
    const wide = width >= WIDE

    const budget = (
        <BudgetList
            title={logic.budgetTitle}
            rows={logic.budget.rows}
            uncategorized={logic.budget.uncategorized}
            goals={logic.goals}
            onCategorize={() => navigation?.navigate?.('Transactions')}
            onEditBudget={() => navigation?.navigate?.('Budget')}
        />
    )
    const side = (
        <>
            <MonthlyTrend transactions={logic.forTotals} selectedYear={logic.selectedYear} />
            <ActivityList title="Coming up" items={logic.upcoming} empty="No subscriptions due in the next 30 days."
                notice={logic.possibleSubscriptions > 0 ? {
                    text: logic.possibleSubscriptions === 1 ? '1 charge looks like a subscription you haven\'t added.'
                        : `${logic.possibleSubscriptions} charges look like subscriptions you haven't added.`,
                    action: 'Review', a11y: 'Review possible subscriptions',
                    onPress: () => navigation?.navigate?.('Subscriptions'),
                } : null} />
            <ActivityList title="Recent" items={logic.recent} empty="No transactions yet." />
        </>
    )

    return (
        <ScrollView style={[styles.page, { backgroundColor: backdrop }]} contentContainerStyle={[styles.content, !wide && styles.contentNarrow]}>
            <View style={styles.inner}>
                <PeriodHeader
                    title={logic.title}
                    view={logic.view}
                    onPrev={logic.prev}
                    onNext={logic.next}
                    onView={logic.setView}
                    onToday={logic.isCurrent ? undefined : logic.goToday}
                />
                <SpendingSummary
                    heading={logic.heading}
                    spent={logic.summary.spent}
                    planned={logic.plannedTotal}
                    elapsed={logic.elapsed}
                    income={logic.summary.income}
                    saved={logic.summary.saved}
                    left={logic.summary.left}
                    remainingDays={logic.daysLeft}
                    wide={wide}
                />
                <AccountsRow cash={logic.bank.cash} savings={logic.bank.savings} cards={logic.bank.cards} updatedAt={logic.updatedAt} wide={wide} />

                {wide ? (
                    <View style={styles.columns}>
                        <View style={styles.main}>{budget}</View>
                        <View style={styles.side}>{side}</View>
                    </View>
                ) : (
                    <>{budget}{side}</>
                )}
            </View>
        </ScrollView>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    page: { flex: 1, backgroundColor: C.page },
    content: { padding: 28, alignItems: 'center' },
    contentNarrow: { padding: 16 },
    inner: { width: '100%', maxWidth: 1180 },
    columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    main: { flex: 7, minWidth: 0 },
    side: { flex: 5, minWidth: 0 },
})
