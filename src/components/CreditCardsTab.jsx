import { useState } from "react";

export default function CreditCardsTab({
  colors,
  inputStyle,
  buttonStyle,
  cardStyle,
  summaryCardStyle,
  formatCurrency,
  formatAmountInput,
  creditCards,
  creditCardName,
  setCreditCardName,
  creditCardBalance,
  setCreditCardBalance,
  creditCardLimit,
  setCreditCardLimit,
  creditCardMinimumPayment,
  setCreditCardMinimumPayment,
  creditCardDueDate,
  setCreditCardDueDate,
  creditCardNote,
  setCreditCardNote,
  addCreditCard,
  deleteCreditCard,
  creditCardActionAmounts,
  setCreditCardActionAmounts,
  creditCardActionNotes,
  setCreditCardActionNotes,
  addCreditCardCharge,
  addCreditCardPayment,
  updateCreditCardMinimumPayment,
  updateCreditCardLimit,
  updateCreditCardDueDate,
  editingCreditCardActivity,
  setEditingCreditCardActivity,
  startEditingCreditCardActivity,
  cancelEditingCreditCardActivity,
  saveEditedCreditCardActivity,
  deleteCreditCardActivity,
  totalCreditCardDebt,
  totalCreditLimit,
  totalCreditAvailable,
  overallCreditUtilization,
  pageTitleStyle,
  summaryGridStyle,
  actionRowStyle,
}) {
  const [minimumPaymentEdits, setMinimumPaymentEdits] = useState({});
  const [creditLimitEdits, setCreditLimitEdits] = useState({});
  const [dueDateEdits, setDueDateEdits] = useState({});

  const sortedCards = [...creditCards].sort((a, b) => {
    const aDue = a.dueDate || "";
    const bDue = b.dueDate || "";

    if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
    return Number(b.balance || 0) - Number(a.balance || 0);
  });

  const getUtilization = (card) => {
    const balance = Number(card.balance || 0);
    const limit = Number(card.limit || 0);

    if (limit <= 0) return null;
    return Math.max(0, (balance / limit) * 100);
  };

  const getAvailableCredit = (card) => {
    const balance = Number(card.balance || 0);
    const limit = Number(card.limit || 0);

    if (limit <= 0) return null;
    return Math.max(0, limit - balance);
  };

  const getUtilizationMeta = (utilization) => {
    if (utilization === null) {
      return {
        label: "No limit entered",
        backgroundColor: colors.card,
        borderColor: colors.border,
      };
    }

    if (utilization >= 80) {
      return {
        label: "High",
        backgroundColor: "rgba(255, 107, 107, 0.16)",
        borderColor: "rgba(255, 107, 107, 0.48)",
      };
    }

    if (utilization >= 50) {
      return {
        label: "Medium",
        backgroundColor: "rgba(255, 200, 90, 0.15)",
        borderColor: "rgba(255, 200, 90, 0.45)",
      };
    }

    return {
      label: "Good",
      backgroundColor: "rgba(80, 200, 120, 0.14)",
      borderColor: "rgba(80, 200, 120, 0.45)",
    };
  };

  const startMinimumPaymentEdit = (card) => {
    setMinimumPaymentEdits((prev) => ({
      ...prev,
      [card.id]: String(Math.abs(Number(card.minimumPayment || 0))),
    }));
  };

  const cancelMinimumPaymentEdit = (cardId) => {
    setMinimumPaymentEdits((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const saveMinimumPaymentEdit = (cardId) => {
    updateCreditCardMinimumPayment(cardId, minimumPaymentEdits[cardId] || "");

    setMinimumPaymentEdits((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const startCreditLimitEdit = (card) => {
    setCreditLimitEdits((prev) => ({
      ...prev,
      [card.id]: String(Math.abs(Number(card.limit || 0))),
    }));
  };

  const cancelCreditLimitEdit = (cardId) => {
    setCreditLimitEdits((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const saveCreditLimitEdit = (cardId) => {
    updateCreditCardLimit(cardId, creditLimitEdits[cardId] || "");

    setCreditLimitEdits((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const startDueDateEdit = (card) => {
    setDueDateEdits((prev) => ({
      ...prev,
      [card.id]: card.dueDate || "",
    }));
  };

  const cancelDueDateEdit = (cardId) => {
    setDueDateEdits((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const saveDueDateEdit = (cardId) => {
    updateCreditCardDueDate(cardId, dueDateEdits[cardId] || "");

    setDueDateEdits((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const renderMoneyStat = (label, value, extra = null) => (
    <div style={summaryCardStyle}>
      <div style={{ color: colors.subtext, fontSize: "14px", marginBottom: "8px" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: "800" }}>{value}</div>
      {extra && (
        <div style={{ color: colors.subtext, fontSize: "13px", marginTop: "8px" }}>
          {extra}
        </div>
      )}
    </div>
  );

  return (
    <>
      <h1 style={pageTitleStyle}>Credit Cards</h1>

      <div style={summaryGridStyle}>
        {renderMoneyStat(
          "Total Credit Card Debt",
          `$${formatCurrency(totalCreditCardDebt)}`
        )}

        {renderMoneyStat(
          "Available Credit",
          `$${formatCurrency(totalCreditAvailable)}`,
          totalCreditLimit > 0
            ? `Total limit: $${formatCurrency(totalCreditLimit)}`
            : "Add limits to track utilization."
        )}

        {renderMoneyStat(
          "Overall Utilization",
          totalCreditLimit > 0
            ? `${overallCreditUtilization.toFixed(1)}%`
            : "—",
          "Lower is usually better."
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Add Credit Card</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px",
          }}
        >
          <input
            style={inputStyle}
            placeholder="Card name"
            value={creditCardName}
            onChange={(event) => setCreditCardName(event.target.value)}
          />

          <input
            style={inputStyle}
            inputMode="decimal"
            placeholder="Current balance owed"
            value={creditCardBalance}
            onChange={(event) =>
              setCreditCardBalance(formatAmountInput(event.target.value))
            }
          />

          <input
            style={inputStyle}
            inputMode="decimal"
            placeholder="Credit limit"
            value={creditCardLimit}
            onChange={(event) =>
              setCreditCardLimit(formatAmountInput(event.target.value))
            }
          />

          <input
            style={inputStyle}
            inputMode="decimal"
            placeholder="Minimum payment"
            value={creditCardMinimumPayment}
            onChange={(event) =>
              setCreditCardMinimumPayment(formatAmountInput(event.target.value))
            }
          />

          <input
            style={inputStyle}
            type="date"
            value={creditCardDueDate}
            onChange={(event) => setCreditCardDueDate(event.target.value)}
          />

          <input
            style={inputStyle}
            placeholder="Note"
            value={creditCardNote}
            onChange={(event) => setCreditCardNote(event.target.value)}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <button onClick={addCreditCard} style={buttonStyle}>
            Add Credit Card
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Cards</h3>

        {sortedCards.length === 0 ? (
          <p style={{ color: colors.subtext }}>No credit cards added yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "12px",
            }}
          >
            {sortedCards.map((card) => {
              const utilization = getUtilization(card);
              const utilizationMeta = getUtilizationMeta(utilization);
              const availableCredit = getAvailableCredit(card);
              const history = Array.isArray(card.history) ? card.history : [];
              const isEditingMinimumPayment = Object.prototype.hasOwnProperty.call(
                minimumPaymentEdits,
                card.id
              );
              const isEditingCreditLimit = Object.prototype.hasOwnProperty.call(
                creditLimitEdits,
                card.id
              );
              const isEditingDueDate = Object.prototype.hasOwnProperty.call(
                dueDateEdits,
                card.id
              );

              return (
                <div
                  key={card.id}
                  style={{
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "14px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "10px",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "800", fontSize: "18px" }}>
                        {card.name}
                      </div>
                      {card.note && (
                        <div
                          style={{
                            color: colors.subtext,
                            fontSize: "13px",
                            marginTop: "4px",
                          }}
                        >
                          {card.note}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => deleteCreditCard(card.id)}
                      style={{
                        ...buttonStyle,
                        width: "auto",
                        minHeight: "38px",
                        padding: "8px 10px",
                        backgroundColor: "rgba(255, 107, 107, 0.13)",
                        border: "1px solid rgba(255, 107, 107, 0.45)",
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  <div style={{ marginTop: "12px", lineHeight: 1.75 }}>
                    <div>
                      Balance owed:{" "}
                      <strong>${formatCurrency(Number(card.balance || 0))}</strong>
                    </div>
                    <div style={{ marginTop: "8px" }}>
                      {!isEditingCreditLimit ? (
                        <>
                          Credit limit:{" "}
                          <strong>${formatCurrency(Number(card.limit || 0))}</strong>
                          <button
                            onClick={() => startCreditLimitEdit(card)}
                            style={{
                              ...buttonStyle,
                              width: "auto",
                              minHeight: "34px",
                              padding: "6px 10px",
                              marginLeft: "8px",
                            }}
                          >
                            Edit
                          </button>
                        </>
                      ) : (
                        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                          <input
                            style={inputStyle}
                            inputMode="decimal"
                            value={creditLimitEdits[card.id] || ""}
                            onChange={(event) =>
                              setCreditLimitEdits((prev) => ({
                                ...prev,
                                [card.id]: formatAmountInput(event.target.value),
                              }))
                            }
                            placeholder="Credit limit"
                          />
                          <div style={actionRowStyle}>
                            <button
                              onClick={() => saveCreditLimitEdit(card.id)}
                              style={buttonStyle}
                            >
                              Save Limit
                            </button>
                            <button
                              onClick={() => cancelCreditLimitEdit(card.id)}
                              style={buttonStyle}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      Available credit:{" "}
                      <strong>
                        {availableCredit === null
                          ? "—"
                          : `$${formatCurrency(availableCredit)}`}
                      </strong>
                    </div>

                    <div style={{ marginTop: "8px" }}>
                      {!isEditingMinimumPayment ? (
                        <>
                          Minimum payment:{" "}
                          <strong>
                            ${formatCurrency(Number(card.minimumPayment || 0))}
                          </strong>
                          <button
                            onClick={() => startMinimumPaymentEdit(card)}
                            style={{
                              ...buttonStyle,
                              width: "auto",
                              minHeight: "34px",
                              padding: "6px 10px",
                              marginLeft: "8px",
                            }}
                          >
                            Edit
                          </button>
                        </>
                      ) : (
                        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                          <input
                            style={inputStyle}
                            inputMode="decimal"
                            value={minimumPaymentEdits[card.id] || ""}
                            onChange={(event) =>
                              setMinimumPaymentEdits((prev) => ({
                                ...prev,
                                [card.id]: formatAmountInput(event.target.value),
                              }))
                            }
                            placeholder="Minimum payment"
                          />
                          <div style={actionRowStyle}>
                            <button
                              onClick={() => saveMinimumPaymentEdit(card.id)}
                              style={buttonStyle}
                            >
                              Save Minimum
                            </button>
                            <button
                              onClick={() => cancelMinimumPaymentEdit(card.id)}
                              style={buttonStyle}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: "8px" }}>
                      {!isEditingDueDate ? (
                        <>
                          Due date: <strong>{card.dueDate || "Not set"}</strong>
                          <button
                            onClick={() => startDueDateEdit(card)}
                            style={{
                              ...buttonStyle,
                              width: "auto",
                              minHeight: "34px",
                              padding: "6px 10px",
                              marginLeft: "8px",
                            }}
                          >
                            Edit
                          </button>
                        </>
                      ) : (
                        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                          <input
                            style={inputStyle}
                            type="date"
                            value={dueDateEdits[card.id] || ""}
                            onChange={(event) =>
                              setDueDateEdits((prev) => ({
                                ...prev,
                                [card.id]: event.target.value,
                              }))
                            }
                          />
                          <div style={actionRowStyle}>
                            <button
                              onClick={() => saveDueDateEdit(card.id)}
                              style={buttonStyle}
                            >
                              Save Due Date
                            </button>
                            <button
                              onClick={() => cancelDueDateEdit(card.id)}
                              style={buttonStyle}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      borderRadius: "10px",
                      backgroundColor: utilizationMeta.backgroundColor,
                      border: `1px solid ${utilizationMeta.borderColor}`,
                    }}
                  >
                    <div style={{ fontWeight: "700" }}>
                      Utilization:{" "}
                      {utilization === null ? "—" : `${utilization.toFixed(1)}%`}
                    </div>
                    <div style={{ color: colors.subtext, fontSize: "13px" }}>
                      Status: {utilizationMeta.label}
                    </div>
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <input
                      style={inputStyle}
                      inputMode="decimal"
                      placeholder="Payment or charge amount"
                      value={creditCardActionAmounts[card.id] || ""}
                      onChange={(event) =>
                        setCreditCardActionAmounts((prev) => ({
                          ...prev,
                          [card.id]: formatAmountInput(event.target.value),
                        }))
                      }
                    />

                    <input
                      style={{ ...inputStyle, marginTop: "8px" }}
                      placeholder="Action note"
                      value={creditCardActionNotes[card.id] || ""}
                      onChange={(event) =>
                        setCreditCardActionNotes((prev) => ({
                          ...prev,
                          [card.id]: event.target.value,
                        }))
                      }
                    />

                    <div style={{ ...actionRowStyle, marginTop: "8px" }}>
                      <button
                        onClick={() => addCreditCardPayment(card.id)}
                        style={{
                          ...buttonStyle,
                          border: "1px solid rgba(80, 200, 120, 0.45)",
                        }}
                      >
                        Add Payment
                      </button>

                      <button
                        onClick={() => addCreditCardCharge(card.id)}
                        style={{
                          ...buttonStyle,
                          border: "1px solid rgba(255, 107, 107, 0.45)",
                        }}
                      >
                        Add Charge
                      </button>
                    </div>
                  </div>

                  {history.length > 0 && (
                    <div style={{ marginTop: "14px" }}>
                      <div style={{ fontWeight: "700", marginBottom: "8px" }}>
                        Recent activity
                      </div>

                      <div style={{ display: "grid", gap: "8px" }}>
                        {[...history]
                          .sort((a, b) =>
                            `${b.date}-${String(b.id)}`.localeCompare(
                              `${a.date}-${String(a.id)}`
                            )
                          )
                          .map((item) => {
                            const isEditingActivity =
                              editingCreditCardActivity?.cardId === card.id &&
                              editingCreditCardActivity?.activityId === item.id;

                            return (
                              <div
                                key={item.id}
                                style={{
                                  padding: "9px",
                                  borderRadius: "9px",
                                  backgroundColor:
                                    item.type === "payment"
                                      ? "rgba(80, 200, 120, 0.12)"
                                      : "rgba(255, 107, 107, 0.12)",
                                  border:
                                    item.type === "payment"
                                      ? "1px solid rgba(80, 200, 120, 0.35)"
                                      : "1px solid rgba(255, 107, 107, 0.35)",
                                }}
                              >
                                {!isEditingActivity ? (
                                  <>
                                    <div style={{ fontWeight: "700" }}>
                                      {item.type === "payment" ? "Payment" : "Charge"}: $
                                      {formatCurrency(Number(item.amount || 0))}
                                    </div>
                                    <div
                                      style={{
                                        color: colors.subtext,
                                        fontSize: "13px",
                                        marginTop: "3px",
                                      }}
                                    >
                                      {item.date}
                                      {item.note ? ` — ${item.note}` : ""}
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        flexWrap: "wrap",
                                        marginTop: "8px",
                                      }}
                                    >
                                      <button
                                        onClick={() =>
                                          startEditingCreditCardActivity(card.id, item)
                                        }
                                        style={{
                                          ...buttonStyle,
                                          width: "auto",
                                          minHeight: "34px",
                                          padding: "6px 10px",
                                        }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() =>
                                          deleteCreditCardActivity(card.id, item.id)
                                        }
                                        style={{
                                          ...buttonStyle,
                                          width: "auto",
                                          minHeight: "34px",
                                          padding: "6px 10px",
                                          backgroundColor: "rgba(255, 107, 107, 0.13)",
                                          border:
                                            "1px solid rgba(255, 107, 107, 0.45)",
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ display: "grid", gap: "8px" }}>
                                    <input
                                      style={inputStyle}
                                      inputMode="decimal"
                                      value={editingCreditCardActivity.amount}
                                      onChange={(event) =>
                                        setEditingCreditCardActivity((prev) => ({
                                          ...prev,
                                          amount: formatAmountInput(event.target.value),
                                        }))
                                      }
                                    />
                                    <input
                                      style={inputStyle}
                                      value={editingCreditCardActivity.note}
                                      placeholder="Activity note"
                                      onChange={(event) =>
                                        setEditingCreditCardActivity((prev) => ({
                                          ...prev,
                                          note: event.target.value,
                                        }))
                                      }
                                    />
                                    <div style={actionRowStyle}>
                                      <button
                                        onClick={saveEditedCreditCardActivity}
                                        style={buttonStyle}
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={cancelEditingCreditCardActivity}
                                        style={buttonStyle}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
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
