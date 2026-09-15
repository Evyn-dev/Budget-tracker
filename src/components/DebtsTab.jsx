export default function DebtsTab({
  colors,
  inputStyle,
  buttonStyle,
  cardStyle,
  summaryCardStyle,
  formatCurrency,
  totalDebtAmount,
  debts,
  debtName,
  setDebtName,
  debtAmount,
  setDebtAmount,
  formatAmountInput,
  debtNote,
  setDebtNote,
  addDebt,
  orderedDebts,
  editingDebtId,
  editingDebtName,
  setEditingDebtName,
  editingDebtNote,
  setEditingDebtNote,
  saveDebtEdit,
  cancelDebtEdit,
  debtAdjustAmounts,
  setDebtAdjustAmounts,
  increaseDebt,
  decreaseDebt,
  startEditingDebt,
  deleteDebt,
  pageTitleStyle,
  summaryGridStyle,
  actionRowStyle,
}) {
  return (
    <>
      <h1 style={pageTitleStyle}>Debts Owed To Me</h1>

      <div style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <div style={{ color: colors.subtext, fontSize: "14px" }}>Total Owed To Me</div>
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>
            ${formatCurrency(totalDebtAmount)}
          </div>
        </div>

        <div style={summaryCardStyle}>
          <div style={{ color: colors.subtext, fontSize: "14px" }}>Tracked Debts</div>
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>
            {debts.length}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Add New Debt</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            type="text"
            placeholder="Name"
            value={debtName}
            onChange={(e) => setDebtName(e.target.value)}
            style={inputStyle}
          />

          <input
            type="text"
            inputMode="decimal"
            placeholder="Amount"
            value={debtAmount}
            onChange={(e) => setDebtAmount(formatAmountInput(e.target.value))}
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Add a note"
            value={debtNote}
            onChange={(e) => setDebtNote(e.target.value)}
            style={inputStyle}
          />

          <button onClick={addDebt} style={buttonStyle}>
            Add Debt
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Debt List</h3>

        {orderedDebts.length === 0 ? (
          <p style={{ color: colors.subtext }}>No debts tracked yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {orderedDebts.map((debt) => {
              const isEditing = editingDebtId === debt.id;
              const adjustValue = debtAdjustAmounts[debt.id] || "";

              return (
                <div
                  key={debt.id}
                  style={{
                    backgroundColor: colors.debtBg,
                    border: `1px solid ${colors.debtBorder}`,
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: "grid", gap: "10px" }}>
                      <input
                        type="text"
                        value={editingDebtName}
                        onChange={(e) => setEditingDebtName(e.target.value)}
                        style={inputStyle}
                      />
                      <input
                        type="text"
                        value={editingDebtNote}
                        onChange={(e) => setEditingDebtNote(e.target.value)}
                        style={inputStyle}
                      />
                      <div style={actionRowStyle}>
                        <button
                          onClick={saveDebtEdit}
                          style={{ ...buttonStyle, flex: 1 }}
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelDebtEdit}
                          style={{ ...buttonStyle, flex: 1 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ color: colors.text, fontWeight: "bold" }}>
                        {debt.name} — ${formatCurrency(debt.amount)}
                      </div>
                      <div style={{ color: colors.subtext, marginTop: "4px" }}>
                        Created: {debt.createdAt}
                      </div>
                      {debt.note && (
                        <div style={{ color: colors.subtext, marginTop: "4px" }}>
                          Note: {debt.note}
                        </div>
                      )}

                      <div
                        style={{
                          display: "grid",
                          gap: "10px",
                          marginTop: "12px",
                        }}
                      >
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Adjustment amount"
                          value={adjustValue}
                          onChange={(e) =>
                            setDebtAdjustAmounts((prev) => ({
                              ...prev,
                              [debt.id]: formatAmountInput(e.target.value),
                            }))
                          }
                          style={inputStyle}
                        />

                        <div style={actionRowStyle}>
                          <button
                            onClick={() => increaseDebt(debt.id)}
                            style={buttonStyle}
                          >
                            Increase
                          </button>

                          <button
                            onClick={() => decreaseDebt(debt.id)}
                            style={buttonStyle}
                          >
                            Decrease
                          </button>

                          <button
                            onClick={() => startEditingDebt(debt)}
                            style={buttonStyle}
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deleteDebt(debt.id)}
                            style={buttonStyle}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}