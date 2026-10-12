function renderDetection(result) {
    const requiredCounts = countItems(order);
    const detectedCounts = result.detected_counts || countItems(result.detected || []);

    orderList.innerHTML = "";
    Object.entries(requiredCounts).forEach(([item, required]) => {
        const detectedNow = Math.min(detectedCounts[item] || 0, required);
        confirmedCounts[item] = Math.max(confirmedCounts[item] || 0, detectedNow);

        const found = confirmedCounts[item];
        const isComplete = found >= required;
        appendItem(
            orderList,
            `${item} (${found}/${required})`,
            `order-item ${isComplete ? "complete" : "pending"}`,
            isComplete ? "✓" : "✕"
        );
    });

    unexpectedList.innerHTML = "";
    Object.entries(countItems(result.unexpected || [])).forEach(([item, count]) => {
        const suffix = count > 1 ? ` (${count})` : "";
        appendItem(unexpectedList, `${item}${suffix} not in this list`);
    });

    const orderIsComplete = Object.entries(requiredCounts).every(([item, required]) =>
        (confirmedCounts[item] || 0) >= required
    );
    const hasUnexpectedItem = (result.unexpected || []).length > 0;
    if (orderIsComplete && !hasUnexpectedItem) advanceToNextOrder();
}
