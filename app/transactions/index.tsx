import { View, StyleSheet } from 'react-native'
import { useTransactionLogic } from './useTransactionLogic'
import { TransactionList } from './TransactionList'
import { TransactionForm } from './TransactionForm'

export default function TransactionsScreen() {
    const logic = useTransactionLogic()
    //edit
    return (
        <View style={styles.container}>
        <TransactionList
        rows={logic.rows}
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
        editMode={logic.editMode}
        onEnterEdit={() => logic.setEditMode(true)}
        page={logic.page}
        totalPages={logic.totalPages}
        onPageChange={logic.setPage}
        onExport={logic.exportToCSV}
        duplicateMode={logic.duplicateMode}
        onEnterDuplicate={() => logic.setDuplicateMode(true)}
        showImport={logic.showImport}
        onImport={() => logic.setShowImport(true)}
        onCloseImport={() => logic.setShowImport(false)}
        onImported={() => { logic.setShowImport(false); logic.fetchTransactions() }}
        />
        <TransactionForm
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
        onAdd={logic.handleAdd}
        editingTransaction={logic.editingTransaction}
        onEditChange={logic.setEditingTransaction}
        onSaveEdit={logic.handleSaveEdit}
        onCancelEdit={() => logic.setEditingTransaction(null)}
        recurring={logic.recurring}
        recurringEnd={logic.recurringEnd}
        onRecurringChange={logic.setRecurring}
        onRecurringEndChange={logic.setRecurringEnd}
        budgetCategories={logic.budgetCategories}
        />
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f6fa' },
})