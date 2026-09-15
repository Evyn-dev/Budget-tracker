export default function CategoriesTab({
  colors,
  inputStyle,
  buttonStyle,
  cardStyle,
  newExpenseCategory,
  setNewExpenseCategory,
  addCustomCategory,
  allExpenseCategories,
  renderCategoryRow,
  categoryReassignState,
  allIncomeCategories,
  setCategoryReassignState,
  confirmCategoryReassign,
  cancelCategoryReassign,
  newIncomeCategory,
  setNewIncomeCategory,
  hiddenExpenseCategories,
  hiddenIncomeCategories,
  restoreHiddenCategory,
  importExportText,
  setImportExportText,
  exportDataToText,
  importDataFromText,
  pageTitleStyle,
  actionRowStyle,
}) {
  const reassignOptions =
    categoryReassignState?.kind === "expense"
      ? allExpenseCategories.filter(
          (item) => item !== categoryReassignState.sourceCategory
        )
      : allIncomeCategories.filter(
          (item) =>
            item !== categoryReassignState?.sourceCategory && item !== "Refund"
        );

  return (
    <>
      <h1 style={pageTitleStyle}>Categories</h1>

      {categoryReassignState && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: "10px", fontSize: "18px" }}>
            Reassign Category
          </h3>
          <div style={{ color: colors.subtext, marginBottom: "10px" }}>
            Move all transactions from{" "}
            <strong>{categoryReassignState.sourceCategory}</strong> to:
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <select
              value={categoryReassignState.targetCategory}
              onChange={(e) =>
                setCategoryReassignState((prev) =>
                  prev
                    ? {
                        ...prev,
                        targetCategory: e.target.value,
                      }
                    : prev
                )
              }
              style={inputStyle}
            >
              {reassignOptions.map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>

            <div style={actionRowStyle}>
              <button
                onClick={confirmCategoryReassign}
                style={{ ...buttonStyle, flex: 1 }}
              >
                Reassign & Hide
              </button>
              <button
                onClick={cancelCategoryReassign}
                style={{ ...buttonStyle, flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "10px", fontSize: "18px" }}>
          Import / Export
        </h3>

        <div style={{ display: "grid", gap: "10px" }}>
          <textarea
            value={importExportText}
            onChange={(e) => setImportExportText(e.target.value)}
            placeholder="Export will place your shorter compressed backup code here. To import, paste backup text here first."
            style={{
              ...inputStyle,
              minHeight: "180px",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />

          <div style={actionRowStyle}>
            <button
              onClick={exportDataToText}
              style={{ ...buttonStyle, flex: 1 }}
            >
              Export Backup
            </button>
            <button
              onClick={importDataFromText}
              style={{ ...buttonStyle, flex: 1 }}
            >
              Import Backup
            </button>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "10px", fontSize: "18px" }}>
          Expense Categories
        </h3>

        <div style={{ display: "grid", gap: "10px", marginBottom: "12px" }}>
          <input
            type="text"
            value={newExpenseCategory}
            onChange={(e) => setNewExpenseCategory(e.target.value)}
            placeholder="Add expense category"
            style={inputStyle}
          />
          <button onClick={() => addCustomCategory("expense")} style={buttonStyle}>
            Add
          </button>
        </div>

        <div style={{ display: "grid", gap: "10px" }}>
          {allExpenseCategories.map((cat) => renderCategoryRow("expense", cat))}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "10px", fontSize: "18px" }}>
          Income Categories
        </h3>

        <div style={{ display: "grid", gap: "10px", marginBottom: "12px" }}>
          <input
            type="text"
            value={newIncomeCategory}
            onChange={(e) => setNewIncomeCategory(e.target.value)}
            placeholder="Add income category"
            style={inputStyle}
          />
          <button onClick={() => addCustomCategory("income")} style={buttonStyle}>
            Add
          </button>
        </div>

        <div style={{ display: "grid", gap: "10px" }}>
          {allIncomeCategories.map((cat) => renderCategoryRow("income", cat))}
        </div>
      </div>

      {(hiddenExpenseCategories.length > 0 || hiddenIncomeCategories.length > 0) && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: "10px", fontSize: "18px" }}>
            Hidden Categories
          </h3>

          <div style={{ display: "grid", gap: "10px" }}>
            {hiddenExpenseCategories.map((cat) => (
              <div
                key={`hidden-expense-${cat}`}
                style={{
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  padding: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <span>Expense: {cat}</span>
                <button
                  onClick={() => restoreHiddenCategory("expense", cat)}
                  style={buttonStyle}
                >
                  Restore
                </button>
              </div>
            ))}

            {hiddenIncomeCategories.map((cat) => (
              <div
                key={`hidden-income-${cat}`}
                style={{
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  padding: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <span>Income: {cat}</span>
                <button
                  onClick={() => restoreHiddenCategory("income", cat)}
                  style={buttonStyle}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}