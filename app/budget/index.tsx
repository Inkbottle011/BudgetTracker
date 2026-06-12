import { useBudgetLogic } from './useBudgetLogic'
import { BudgetTable } from './BudgetTable'

export default function BudgetScreen() {
    const logic = useBudgetLogic()
    
    return (
        <BudgetTable
        year={logic.year}
        items={logic.items}
        loading={logic.loading}
        addingType={logic.addingType}
        newItemName={logic.newItemName}
        newItemType={logic.newItemType}
        editingCell={logic.editingCell}
        editingValue={logic.editingValue}
        onYearChange={logic.setYear}
        onSetAddingType={(t) => {
            logic.setAddingType(t)
            if (t) logic.setNewItemType(t)
            }}            onNewItemName={logic.setNewItemName}
        onNewItemType={logic.setNewItemType}
        onAddItem={logic.handleAddItem}
        onDeleteItem={logic.handleDeleteItem}
        onCellPress={(itemId, month, current) => {
            logic.setEditingCell({ itemId, month })
            logic.setEditingValue(current > 0 ? String(current) : '')
        }}
        onCellChange={logic.setEditingValue}
        onCellSave={(itemId, month, value, fillRight) => logic.handleCellSave(itemId, month, value, fillRight)}
        onCellCancel={() => logic.setEditingCell(null)}
        getAmount={logic.getAmount}
        getRowTotal={logic.getRowTotal}
        getMonthTotal={logic.getMonthTotal}
        getSectionTotal={logic.getSectionTotal}
        getNetByMonth={logic.getNetByMonth}
        getNetTotal={logic.getNetTotal}
        />
    )
}