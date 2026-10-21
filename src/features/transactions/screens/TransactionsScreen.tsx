import { useState } from 'react'
import { View, ScrollView, Modal, StyleSheet } from 'react-native'
import { Page, PageTitle, Button, useIsWide } from '../../../shared/ui/ui'
import { useStyles, useTheme, Palette } from '../../../shared/theme/theme'
import { useTransactionLogic } from '../logic/useTransactionLogic'
import { TransactionList } from './TransactionList'
import { TransactionForm } from './TransactionForm'
import { OwedPanel } from './OwedPanel'
import { UncategorizedPanel } from './UncategorizedPanel'

/**
 * Transactions: the list, with the add/edit form beside it on a computer,
 * or in a full-screen sheet on a phone (opened with "+ Add" or by tapping a row).
 */
export default function TransactionsScreen() {
    const logic = useTransactionLogic()
    const wide = useIsWide()
    const styles = useStyles(makeStyles)
    const { backdrop } = useTheme()
    const [addOpen, setAddOpen] = useState(false)

    const sheetOpen = !wide && (addOpen || !!logic.editingTransaction)
    const closeSheet = () => { setAddOpen(false); logic.setEditingTransaction(null) }

    const list = (
        <>
            <OwedPanel transactions={logic.transactions} onChanged={logic.fetchTransactions} />
            <UncategorizedPanel transactions={logic.transactions} budgetCategories={logic.budgetCategories} onChanged={logic.fetchTransactions} />
            <TransactionList
                rows={logic.rows}
                wide={wide}
                hasTransactions={logic.transactions.length > 0}
                filtering={logic.filtering}
                activeId={logic.editingTransaction?.id}
                selectMode={logic.selectMode}
                selected={logic.selected}
                confirmDelete={logic.confirmDelete}
                deleting={logic.deleting}
                search={logic.search}
                showFilters={logic.showFilters}
                filterType={logic.filterType}
                filterFrom={logic.filterFrom}
                filterTo={logic.filterTo}
                sortCol={logic.sortCol}
                sortDir={logic.sortDir}
                onSearch={logic.setSearch}
                onToggleFilters={() => logic.setShowFilters(v => !v)}
                onFilterType={t => logic.setFilterType(logic.filterType === t ? null : t)}
                onFilterFrom={logic.setFilterFrom}
                onFilterTo={logic.setFilterTo}
                onClearFilters={() => { logic.setFilterType(null); logic.setFilterFrom(''); logic.setFilterTo('') }}
                onSort={logic.handleSort}
                onRowPress={logic.handleEditSelect}
                onEnterSelect={() => logic.setSelectMode(true)}
                onExitSelect={logic.exitSelectMode}
                onConfirmDelete={() => logic.setConfirmDelete(true)}
                onCancelConfirm={() => logic.setConfirmDelete(false)}
                onDelete={logic.handleDelete}
                page={logic.page}
                totalPages={logic.totalPages}
                onPageChange={logic.setPage}
                onExport={logic.exportToCSV}
                showImport={logic.showImport}
                onImport={() => logic.setShowImport(true)}
                onCloseImport={() => logic.setShowImport(false)}
                onImported={() => { logic.setShowImport(false); logic.fetchTransactions() }}
            />
        </>
    )

    const form = (variant: 'card' | 'sheet') => (
        <TransactionForm
            variant={variant}
            onClose={closeSheet}
            type={logic.type}
            category={logic.category}
            name={logic.name}
            amount={logic.amount}
            details={logic.details}
            date={logic.date}
            errors={logic.errors}
            saving={logic.saving}
            success={logic.success}
            onTypeChange={t => { logic.setType(t); logic.setCategory('') }}
            onCategoryChange={logic.setCategory}
            onNameChange={logic.setName}
            onAmountChange={v => { logic.setAmount(v); logic.setErrors(e => ({ ...e, amount: undefined })) }}
            onDetailsChange={logic.setDetails}
            onDateChange={v => { logic.setDate(v); logic.setErrors(e => ({ ...e, date: undefined })) }}
            onAdd={async () => { if (await logic.handleAdd() && variant === 'sheet') setAddOpen(false) }}
            editingTransaction={logic.editingTransaction}
            onEditChange={logic.setEditingTransaction}
            onSaveEdit={logic.handleSaveEdit}
            onCancelEdit={() => logic.setEditingTransaction(null)}
            onDuplicate={logic.duplicateEditing}
            budgetCategories={logic.budgetCategories}
            pastTransactions={logic.transactions}
            onPickSuggestion={logic.applySuggestion}
            splitOpen={logic.splitOpen}
            splits={logic.splits}
            onOpenSplit={logic.openSplit}
            onCloseSplit={logic.closeSplit}
            onSplitsChange={rows => { logic.setSplits(rows); logic.setErrors(e => ({ ...e, split: undefined })) }}
            onSplitEvenly={logic.splitEvenly}
        />
    )

    if (wide) {
        return (
            <View style={[styles.screen, { backgroundColor: backdrop }]}>
                <View style={styles.columns}>
                    <ScrollView style={styles.listColumn} contentContainerStyle={styles.columnContent} keyboardShouldPersistTaps="handled">
                        <PageTitle title="Transactions" />
                        {list}
                    </ScrollView>
                    <ScrollView style={styles.formColumn} contentContainerStyle={styles.columnContent} keyboardShouldPersistTaps="handled">
                        {form('card')}
                    </ScrollView>
                </View>
            </View>
        )
    }

    return (
        <View style={[styles.screen, { backgroundColor: backdrop }]}>
            <Page>
                <PageTitle
                    title="Transactions"
                    actions={<Button label="+ Add" accessibilityLabel="Add a transaction" onPress={() => { logic.setEditingTransaction(null); setAddOpen(true) }} />}
                />
                {list}
            </Page>
            <Modal visible={sheetOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSheet}>
                {form('sheet')}
            </Modal>
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.page },
    columns: { flex: 1, flexDirection: 'row', gap: 24, width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 28 },
    listColumn: { flex: 3 },
    formColumn: { width: 360, flexGrow: 0, flexShrink: 0 },
    columnContent: { paddingVertical: 28 },
})
