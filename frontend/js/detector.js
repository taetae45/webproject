function renderDetection(result) {
    const requiredCounts = countItems(order);
    const detectedCounts = result.detected_counts || countItems(result.detected || []);

    // Track the current number of each product in view as one scan presentation.
    // Commit that quantity after it leaves the frame, with a short flicker guard.
    Object.keys(requiredCounts).forEach(item => {
        const detectedNow = detectedCounts[item] || 0;
        if (detectedNow > 0) {
            activeDetectionCounts[item] = detectedNow;
            absentFrames[item] = 0;
        } else if (activeDetectionCounts[item]) {
            absentFrames[item] = (absentFrames[item] || 0) + 1;
            if (absentFrames[item] >= 2) {
                const remaining = requiredCounts[item] - (confirmedCounts[item] || 0);
                confirmedCounts[item] = (confirmedCounts[item] || 0) + Math.min(activeDetectionCounts[item], remaining);
                delete activeDetectionCounts[item];
                absentFrames[item] = 0;
            }
        }
    });

    orderList.innerHTML = "";
    Object.entries(requiredCounts).forEach(([item, required]) => {
        const found = (confirmedCounts[item] || 0) + (activeDetectionCounts[item] || 0);
        const isComplete = found === required;
        const isOver = found > required;
        const label = isOver ? `${item} (${found}/${required}) — ${found - required} extra` : `${item} (${found}/${required})`;
        appendItem(
            orderList,
            label,
            `order-item ${isComplete ? "complete" : "pending"}`,
            isComplete ? "✓" : "✕"
        );
    });

    unexpectedList.innerHTML = "";
    Object.entries(countItems(result.unexpected || [])).forEach(([item, count]) => {
        const suffix = count > 1 ? ` (${count})` : "";
        appendItem(unexpectedList, `${item}${suffix} not in this list`, "order-item pending", "✕");
    });

    const orderIsComplete = Object.entries(requiredCounts).every(([item, required]) =>
        (confirmedCounts[item] || 0) + (activeDetectionCounts[item] || 0) === required
    );
    const hasUnexpectedItem = (result.unexpected || []).length > 0;
    if (orderIsComplete && !hasUnexpectedItem) advanceToNextOrder();
    else if (isAdvancingOrder) {
        clearTimeout(autoAdvanceTimer);
        isAdvancingOrder = false;
    }
}
