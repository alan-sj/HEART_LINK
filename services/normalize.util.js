function normalizeRootCauses(rows = []) {
    return rows.map(r => ({
        room: r.ROOM_TYPE ?? "Unknown",
        issue: r.ROOT_CAUSE ?? "Unclassified issue",
        signals: r.SUPPORTING_SIGNALS ?? "",
        confidence: r.AVG_CONFIDENCE ?? null
    }));
}

function normalizeFutureRisks(rows = []) {
    return rows.map(r => ({
        room: r.ROOM_TYPE ?? "Unknown",
        event: r.EVENT_NAME ?? "Unknown event",
        severity: r.SEVERITY ?? "LOW"
    }));
}

module.exports = {
    normalizeRootCauses,
    normalizeFutureRisks
};
