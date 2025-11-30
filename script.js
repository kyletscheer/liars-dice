// ============== MATH HELPERS ==============
function binomialCoefficient(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n / 2) k = n - k;
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = (res * (n - i + 1)) / i;
  }
  return res;
}

function binomialTail(n, p, k) {
  if (k <= 0) return 1.0;
  if (k > n) return 0.0;
  let sum = 0.0;
  for (let i = k; i <= n; i++) {
    sum += binomialCoefficient(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  }
  return sum;
}

function calculateNormalProbability(
  quantity,
  face,
  yourDice,
  totalDice,
  wildOnes
) {
  const p = wildOnes && face !== 1 ? 2.0 / 6.0 : 1.0 / 6.0;
  const yourContribution = yourDice.filter(
    (die) => die === face || (wildOnes && die === 1 && face !== 1)
  ).length;
  const remainingDice = totalDice - yourDice.length;
  const requiredCount = Math.max(0, quantity - yourContribution);
  const probability = binomialTail(remainingDice, p, requiredCount);
  return {
    probability,
    yourContribution,
    requiredCount,
    remainingDice,
    p,
  };
}

function calculateAdjustedProbability(
  bluffRate,
  totalDice,
  yourDice,
  claimantDice,
  claimQuantity,
  claimFace,
  wildOnes
) {
  const p = wildOnes && claimFace !== 1 ? 2.0 / 6.0 : 1.0 / 6.0;
  const yourContribution = yourDice.filter(
    (d) => d === claimFace || (wildOnes && d === 1 && claimFace !== 1)
  ).length;
  const unknownDiceTotal = totalDice - yourDice.length;
  const restDice = unknownDiceTotal - claimantDice;
  const R = Math.max(0, claimQuantity - yourContribution);
  const threshold = Math.floor(claimantDice * p);

  let priorProbs = [];
  for (let k = 0; k <= claimantDice; k++) {
    priorProbs.push(
      binomialCoefficient(claimantDice, k) *
        Math.pow(p, k) *
        Math.pow(1 - p, claimantDice - k)
    );
  }

  const pClaimGivenK = priorProbs.map((_, k) =>
    k >= threshold ? 1.0 : bluffRate
  );
  const combinedProbs = priorProbs.map((prob, i) => prob * pClaimGivenK[i]);
  const PClaim = combinedProbs.reduce((a, b) => a + b, 0);
  const posteriorProbs = combinedProbs.map((prob) => prob / PClaim);

  let probTrueGivenK = [];
  for (let k = 0; k <= claimantDice; k++) {
    const need = Math.max(0, R - k);
    probTrueGivenK.push(binomialTail(restDice, p, need));
  }

  const finalWeightedProbs = posteriorProbs.map(
    (prob, i) => prob * probTrueGivenK[i]
  );
  const totalProb = finalWeightedProbs.reduce((a, b) => a + b, 0);

  return {
    probability: totalProb,
    yourContribution,
    requiredCount: R,
    p,
    threshold,
    priorProbs,
    pClaimGivenK,
    combinedProbs,
    posteriorProbs,
    probTrueGivenK,
    finalWeightedProbs,
    PClaim,
    claimantDice,
    restDice,
  };
}

// ============== STATE ==============
const state = {
  totalDice: 15,
  yourDice: [1, 3, 3, 5, 6],
  claimQuantity: 5,
  claimFace: 3,
  claimantDice: 5,
  wildOnes: true,
  bluffRate: 0.1,
  showPips: false,
  hiddenSections: new Set(),
  sectionOrder: ["probabilities", "recommended", "distribution", "moves"],
};

// ============== SECTION MANAGEMENT ==============
function toggleSection(section) {
  if (state.hiddenSections.has(section)) {
    state.hiddenSections.delete(section);
  } else {
    state.hiddenSections.add(section);
  }
  saveSectionState();
  updateSectionVisibility();
}

function updateSectionVisibility() {
  document.querySelectorAll(".result-card").forEach((card) => {
    const section = card.dataset.section;
    const eyeIcon = card.querySelector(".eye-icon");

    if (state.hiddenSections.has(section)) {
      card.classList.add("collapsed");
      if (eyeIcon) eyeIcon.textContent = "👁️‍🗨️";
    } else {
      card.classList.remove("collapsed");
      if (eyeIcon) eyeIcon.textContent = "👁️";
    }
  });
}

function saveSectionState() {
  localStorage.setItem(
    "hiddenSections",
    JSON.stringify([...state.hiddenSections])
  );
  localStorage.setItem("sectionOrder", JSON.stringify(state.sectionOrder));
}

function loadSectionState() {
  const hidden = localStorage.getItem("hiddenSections");
  const order = localStorage.getItem("sectionOrder");

  if (hidden) {
    state.hiddenSections = new Set(JSON.parse(hidden));
  }
  if (order) {
    state.sectionOrder = JSON.parse(order);
    applySectionOrder();
  }
  updateSectionVisibility();
}

function applySectionOrder() {
  const container = document
    .getElementById("resultsColumn")
    .querySelector("#calculatorView");
  state.sectionOrder.forEach((section, index) => {
    const card = container.querySelector(`[data-section="${section}"]`);
    if (card) {
      card.style.order = index;
    }
  });
}

// ============== DRAG AND DROP ==============
let draggedElement = null;

function initDragAndDrop() {
  const cards = document.querySelectorAll(".result-card");

  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      draggedElement = card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", (e) => {
      card.classList.remove("dragging");
      draggedElement = null;
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (draggedElement && draggedElement !== card) {
        const container = card.parentElement;
        const afterElement = getDragAfterElement(container, e.clientY);

        if (afterElement == null) {
          container.appendChild(draggedElement);
        } else {
          container.insertBefore(draggedElement, afterElement);
        }
      }
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      updateSectionOrderFromDOM();
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".result-card:not(.dragging)"),
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

function updateSectionOrderFromDOM() {
  const cards = document.querySelectorAll(".result-card");
  state.sectionOrder = Array.from(cards).map((card) => card.dataset.section);
  saveSectionState();
  applySectionOrder();
}

// ============== SPINNER CONTROLS ==============
function incrementTotal() {
  state.totalDice = Math.min(100, state.totalDice + 1);
  if (state.yourDice.length >= state.totalDice) {
    state.yourDice = state.yourDice.slice(0, state.totalDice - 1);
  }
  updateUI();
}

function decrementTotal() {
  state.totalDice = Math.max(2, state.totalDice - 1);
  if (state.yourDice.length >= state.totalDice) {
    state.yourDice = state.yourDice.slice(0, state.totalDice - 1);
  }
  updateUI();
}

function incrementQuantity() {
  state.claimQuantity = Math.min(100, state.claimQuantity + 1);
  updateUI();
}

function decrementQuantity() {
  state.claimQuantity = Math.max(1, state.claimQuantity - 1);
  updateUI();
}

function incrementClaimant() {
  state.claimantDice = Math.min(100, state.claimantDice + 1);
  updateUI();
}

function decrementClaimant() {
  state.claimantDice = Math.max(1, state.claimantDice - 1);
  updateUI();
}

function rotateFace() {
  const btn = document.getElementById("claimFaceButton");

  // Remove any existing flipping class to allow retriggering
  btn.classList.remove("flipping");

  // Force a reflow so the class re-applies correctly
  void btn.offsetWidth;

  // Add the flipping class
  btn.classList.add("flipping");

  // When animation ends, clean up the class
  const handleEnd = () => {
    btn.classList.remove("flipping");
    btn.removeEventListener("animationend", handleEnd);
  };

  btn.addEventListener("animationend", handleEnd);

  // Cycle the face
  state.claimFace = (state.claimFace % 6) + 1;
  updateUI();
}

// ============== PIP RENDERING ==============
function createPipDisplay(number) {
  const pipPositions = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 1, 2, 6, 7, 8],
  };

  let html = '<div class="pip-display">';
  for (let i = 0; i < 9; i++) {
    const hasPip = pipPositions[number].includes(i);
    html += `<div class="pip ${hasPip ? "" : "visibility-hidden"}"></div>`;
  }
  html += "</div>";
  return html;
}

// ============== RECOMMENDED MOVE ==============
function computeRecommendedMove() {
  const {
    totalDice,
    yourDice,
    claimQuantity,
    claimFace,
    claimantDice,
    wildOnes,
    bluffRate,
  } = state;

  if (totalDice < yourDice.length || totalDice <= 0) return null;

  // Probability that the previous claim is true
  const claimTrue = calculateAdjustedProbability(
    bluffRate,
    totalDice,
    yourDice,
    claimantDice,
    claimQuantity,
    claimFace,
    wildOnes
  ).probability;

  // Probability that calling liar succeeds
  const callLiarProb = Math.max(0, Math.min(1, 1 - claimTrue));

  // Find best next claim
  const tbody = document.getElementById("movesTableBody");
  let bestClaim = null;
  let bestProb = 0;

  for (let i = claimQuantity; i <= claimQuantity + 2; i++) {
    for (let j = 1; j <= 6; j++) {
      if (i === claimQuantity && j <= claimFace) continue;

      const isSameFace =
        j === claimFace || (wildOnes && j === 1 && claimFace !== 1);
      const probWith = isSameFace
        ? calculateAdjustedProbability(
            bluffRate,
            totalDice,
            yourDice,
            claimantDice,
            i,
            j,
            wildOnes
          ).probability
        : calculateNormalProbability(i, j, yourDice, totalDice, wildOnes)
            .probability *
          (1 - bluffRate * 0.5);

      if (probWith > bestProb) {
        bestProb = probWith;
        bestClaim = { quantity: i, face: j, probability: probWith };
      }
    }
  }

  // Compare calling liar vs best claim
  if (callLiarProb >= bestProb) {
    return { type: "callLiar", probability: callLiarProb };
  } else if (bestClaim) {
    return { type: "claim", ...bestClaim };
  } else {
    return { type: "callLiar", probability: callLiarProb };
  }
}

// ============== UI UPDATES ==============
function renderDiceInput() {
  const grid = document.getElementById("diceInput");
  grid.innerHTML = "";
  for (let i = 1; i <= 6; i++) {
    const btn = document.createElement("button");
    btn.className = "die";
    btn.innerHTML = state.showPips ? createPipDisplay(i) : i;
    btn.onclick = () => addDie(i);
    grid.appendChild(btn);
  }
}

function renderYourDice() {
  const display = document.getElementById("yourDiceDisplay");
  display.innerHTML = "";
  if (state.yourDice.length === 0) {
    display.innerHTML =
      '<span style="color: var(--text-secondary);">Click dice above to add them</span>';
    return;
  }
  state.yourDice.forEach((die, idx) => {
    const chip = document.createElement("button");
    chip.className = "die-chip" + (state.showPips ? " pip-mode" : "");
    chip.innerHTML = state.showPips ? createPipDisplay(die) : die;
    chip.onclick = () => removeDie(idx);
    display.appendChild(chip);
  });
}

function updateClaimFaceButton() {
  const btn = document.getElementById("claimFaceButton");
  btn.classList.toggle("pip-mode", state.showPips);
  btn.innerHTML = state.showPips
    ? createPipDisplay(state.claimFace)
    : state.claimFace;
}

function updatePipsToggle() {
  const btn = document.getElementById("pipsToggle");
  btn.textContent = state.showPips ? "⚫" : state.claimFace;
  btn.style.fontSize = state.showPips ? "16px" : "20px";
}

function addDie(face) {
  if (state.yourDice.length < state.totalDice - 1) {
    state.yourDice.push(face);
    updateUI();
  }
}

function removeDie(idx) {
  state.yourDice.splice(idx, 1);
  updateUI();
}

function updateCalculatorView() {
  const {
    totalDice,
    yourDice,
    claimQuantity,
    claimFace,
    claimantDice,
    wildOnes,
    bluffRate,
  } = state;

  const normal = calculateNormalProbability(
    claimQuantity,
    claimFace,
    yourDice,
    totalDice,
    wildOnes
  );
  const adjusted = calculateAdjustedProbability(
    bluffRate,
    totalDice,
    yourDice,
    claimantDice,
    claimQuantity,
    claimFace,
    wildOnes
  );

  document.getElementById("normalProb").textContent =
    (normal.probability * 100).toFixed(1) + "%";
  document.getElementById("adjustedProb").textContent =
    (adjusted.probability * 100).toFixed(1) + "%";

  // Recommended move
  const recommended = computeRecommendedMove();
  const recommendedDiv = document.getElementById("recommendedMove");
  if (recommended) {
    let title = "";
    if (recommended.type === "callLiar") {
      title = "Call Liar";
    } else {
      title = `Claim ${recommended.quantity} ${recommended.face}'s`;
    }
    recommendedDiv.innerHTML = `
                    <div class="recommended-move">
                        <div class="recommended-move-content">
                            <div class="recommended-move-title">${title}</div>
                            <div class="recommended-move-subtitle">Mathematically most likely to succeed, using adjusted probability. Not necessarily the best strategic move.</div>
                        </div>
                        <div class="recommended-move-prob">${(
                          recommended.probability * 100
                        ).toFixed(1)}%</div>
                    </div>
                `;
  }

  // Distribution
  const grid = document.getElementById("distributionGrid");
  grid.innerHTML = "";
  const unknownDice = totalDice - yourDice.length;
  const maxExpected = wildOnes
    ? yourDice.length + unknownDice * (2 / 6)
    : totalDice;

  for (let face = 1; face <= 6; face++) {
    const p = wildOnes && face !== 1 ? 2 / 6 : 1 / 6;
    const knownCount = yourDice.filter(
      (d) => d === face || (wildOnes && d === 1 && face !== 1)
    ).length;
    const expectedUnknown = unknownDice * p;
    const total = knownCount + expectedUnknown;
    const progress = maxExpected > 0 ? (total / maxExpected) * 100 : 0;

    const item = document.createElement("div");
    item.className = "distribution-item";
    item.innerHTML = `
                    <div>${face}s</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div>${total.toFixed(1)}</div>
                `;
    grid.appendChild(item);
  }

  // Next moves table
  const tbody = document.getElementById("movesTableBody");
  tbody.innerHTML = "";
  for (let i = claimQuantity; i <= claimQuantity + 2; i++) {
    for (let j = 1; j <= 6; j++) {
      if (i === claimQuantity && j <= claimFace) continue;

      const probWithout = calculateNormalProbability(
        i,
        j,
        yourDice,
        totalDice,
        wildOnes
      ).probability;
      const isSameFace =
        j === claimFace || (wildOnes && j === 1 && claimFace !== 1);
      const probWith = isSameFace
        ? calculateAdjustedProbability(
            bluffRate,
            totalDice,
            yourDice,
            claimantDice,
            i,
            j,
            wildOnes
          ).probability
        : probWithout * (1 - bluffRate * 0.5);

      const row = tbody.insertRow();
      row.innerHTML = `
                        <td><strong>${i} ${j}'s</strong></td>
                        <td>${(probWithout * 100).toFixed(1)}%</td>
                        <td>${(probWith * 100).toFixed(1)}%</td>
                    `;
    }
  }
}

function updateMathView() {
  const {
    totalDice,
    yourDice,
    claimQuantity,
    claimFace,
    claimantDice,
    wildOnes,
    bluffRate,
  } = state;
  const normal = calculateNormalProbability(
    claimQuantity,
    claimFace,
    yourDice,
    totalDice,
    wildOnes
  );
  const adjusted = calculateAdjustedProbability(
    bluffRate,
    totalDice,
    yourDice,
    claimantDice,
    claimQuantity,
    claimFace,
    wildOnes
  );
  if (state.wildOnes) {
    document.getElementById("normalStep1").innerHTML = `
                You have <strong>${yourDice.join(
                  ", "
                )}</strong>. With wild 1s, you contribute <strong>${
      normal.yourContribution
    }</strong> dice to the claim of <strong>${claimQuantity} ${claimFace}'s</strong>.
            `;
  } else {
    document.getElementById("normalStep1").innerHTML = `
                You have <strong>${yourDice.join(
                  ", "
                )}</strong>. With wild 1s off, you contribute <strong>${
      normal.yourContribution
    }</strong> dice to the claim of <strong>${claimQuantity} ${claimFace}'s</strong>.
            `;
  }

  document.getElementById("normalStep2").innerHTML = `
                Unknown dice = Total Dice - Your Dice: ${totalDice} - ${yourDice.length} = <strong>${normal.remainingDice}</strong><br>
                Remaining needed = Claim - Your Contribution: ${claimQuantity} - ${normal.yourContribution} = <strong>${normal.requiredCount}</strong>
            `;

  document.getElementById("normalFormulaGeneric").innerHTML = `
                $$P(X \\ge k) = \\sum_{i=k}^{n} \\binom{n}{i} p^i (1-p)^{n-i}$$ <br><i>where: \\(n\\) is total unknown dice, \\(k\\) is required count, and \\(p\\) is probability of a match.</i>`;
  document.getElementById("normalFormula").innerHTML = `
                $$P(X \\ge ${normal.requiredCount}) = \\sum_{i=${
    normal.requiredCount
  }}^{${normal.remainingDice}} \\binom{${
    normal.remainingDice
  }}{i} (${normal.p.toFixed(3)})^i (${(1 - normal.p).toFixed(3)})^{${
    normal.remainingDice
  }-i}$$
            `;

  updateNormalTable(normal);
  document.getElementById("finalNormalResult").innerHTML = `
                ✅ <strong>Final Normal Probability: ${(
                  normal.probability * 100
                ).toFixed(2)}%</strong>
            `;
  if (state.wildOnes) {
    document.getElementById("adjStep1").innerHTML = `
                You have <strong>${yourDice.join(", ")}</strong>. 
                With wild 1s, you contribute <strong>${
                  adjusted.yourContribution
                }</strong> to the claim of <strong>${claimQuantity} ${claimFace}'s</strong>.<br>
                Remaining needed from other players: <strong>${
                  adjusted.requiredCount
                }</strong>
            `;
  } else {
    document.getElementById("adjStep1").innerHTML = `
                You have <strong>${yourDice.join(", ")}</strong>. 
                Without wild 1s, you contribute <strong>${
                  adjusted.yourContribution
                }</strong> to the claim of <strong>${claimQuantity} ${claimFace}'s</strong>.<br>
                Remaining needed from other players: <strong>${
                  adjusted.requiredCount
                }</strong>
            `;
  }
  document.getElementById("adjFormulaGeneric1").innerHTML = `
                $$P(K=k) = \\binom{n_c}{k} p^k (1-p)^{n_c-k}$$ <br><i>where: \\(n_c\\) is claimant dice, \\(k\\) is matches from claimant, and \\(p\\) is probability of a match.</i>`;
  document.getElementById("adjFormula1").innerHTML = `
                $$P(K=k) = \\binom{${
                  adjusted.claimantDice
                }}{k} (${adjusted.p.toFixed(3)})^k (${(1 - adjusted.p).toFixed(
    3
  )})^{${adjusted.claimantDice}-k}$$
            `;

  updatePriorTable(adjusted);

  document.getElementById("adjStep3").innerHTML = `
                <strong>Expected matches \\(E[K] = n_c × p\\):</strong> ${
                  adjusted.claimantDice
                } × ${adjusted.p.toFixed(3)} = ${(
    adjusted.claimantDice * adjusted.p
  ).toFixed(2)}<br>
                <strong>The bluffing threshold is </strong> $\\lfloor ${(
                  adjusted.claimantDice * adjusted.p
                ).toFixed(2)}\\rfloor \\approx ${adjusted.threshold}$<br>
                <strong>Bluffing rule:</strong> P(claim|K=k) = 1.0 if k ≥ ${
                  adjusted.threshold
                }, else bluffRate
            `;

  document.getElementById("adjFormula2").innerHTML = `
                $$P(K=k | \\text{claim}) = \\frac{P(\\text{claim}|K=k) \\cdot P(K=k)}{P(\\text{claim})}$$
            `;

  updatePosteriorTable(adjusted);
  updateProbTrueTable(adjusted);
  updateFinalAdjTable(adjusted);
  document.getElementById("adj-step5-formula-generic").innerHTML = `
    $$P(\\text{Claim True} | K=k) = \\sum_{j=\\max(0, R-k)}^{n_{rest}} \\binom{n_{rest}}{j} p^j (1-p)^{n_{rest}-j} $$
    <div style="font-size: 0.9rem; margin-top: 8px; color: #555;">
        <i>where \\(n_{rest}\\) is remaining unknown dice, 
        \\(p\\) is probability of a match (1/6 or 2/6 if 1s are wild), and 
        \\(R\\) is total matches remaining needed.</i>
    </div>
  `;
  document.getElementById("adjFinalFormulaGeneric").innerHTML = `
                   $$\\text{Adjusted Probability} = \\sum_{k=0}^{n_c} P(K=k | \\text{claim}) \\cdot P(\\text{claim true} | K=k) $$

            `;
  document.getElementById("finalAdjResult").innerHTML = `
                ✅ <strong>Final Adjusted Probability: ${(
                  adjusted.probability * 100
                ).toFixed(2)}%</strong>
            `;
}

function updateNormalTable(data) {
  const tbody = document.querySelector("#normalTable tbody");
  tbody.innerHTML = "";
  for (let i = data.requiredCount; i <= data.remainingDice; i++) {
    const val =
      binomialCoefficient(data.remainingDice, i) *
      Math.pow(data.p, i) *
      Math.pow(1 - data.p, data.remainingDice - i);
    const row = tbody.insertRow();
    row.innerHTML = `
                    <td>\\(${i}\\)</td>
                    <td>$\\binom{${
                      data.remainingDice
                    }}{${i}} \\cdot (${data.p.toFixed(3)})^${i} \\cdot (${(
      1 - data.p
    ).toFixed(3)})^{${data.remainingDice - i}}$</td>
                    <td>${val.toFixed(5)}</td>
                `;
  }
}

function updatePriorTable(data) {
  const tbody = document.querySelector("#priorTable tbody");
  tbody.innerHTML = "";
  for (let i = 0; i < data.priorProbs.length; i++) {
    const row = tbody.insertRow();
    row.innerHTML = `
                    <td>\\(${i}\\)</td>
                    <td>$\\binom{${
                      data.claimantDice
                    }}{${i}} \\cdot (${data.p.toFixed(3)})^${i} \\cdot (${(
      1 - data.p
    ).toFixed(3)})^{${data.claimantDice - i}}$</td>
                    <td>${data.priorProbs[i].toFixed(3)}</td>
                `;
  }
}

function updatePosteriorTable(data) {
  const tbody = document.querySelector("#posteriorTable tbody");
  tbody.innerHTML = "";
  for (let i = 0; i < data.posteriorProbs.length; i++) {
    const row = tbody.insertRow();
    row.innerHTML = `
                    <td>\\(${i}\\)</td>
                    <td>$\\frac{${(
                      data.priorProbs[i] * data.pClaimGivenK[i]
                    ).toFixed(3)}}{${data.PClaim.toFixed(3)}}$</td>
                    <td>${data.posteriorProbs[i].toFixed(3)}</td>
                `;
  }
}

function updateProbTrueTable(data) {
  // 1. Update the Generic Formula Block above the table
  const rest = data.restDice;
  const pVal = data.p.toFixed(3);
  const pComp = (1 - data.p).toFixed(3);

  // 2. Populate the Table
  const tbody = document.querySelector("#probTrueTable tbody");
  tbody.innerHTML = "";

  for (let k = 0; k < data.probTrueGivenK.length; k++) {
    // Calculate how many matches we need from the "Rest" of the dice
    const needed = Math.max(0, data.requiredCount - k);
    let formulaStr = "";

    // Determine what to show in the Calculation column
    if (k >= data.requiredCount) {
      // If claimant already has enough dice (k >= R), prob is 1.0
      formulaStr = "1.0 (Claimant has enough)";
    } else if (needed > rest) {
      // If we need more dice than exist in the rest, prob is 0.0
      formulaStr = "0.0 (Impossible)";
    } else {
      // Show the actual summation formula with numbers
      formulaStr = `$ \\sum_{j=${needed}}^{${rest}} \\binom{${rest}}{j} (${pVal})^j (${pComp})^{${rest}-j} $`;
    }

    const row = tbody.insertRow();
    row.innerHTML = `
      <td>$${k}$</td>
      <td style="font-size: 0.9em;">${formulaStr}</td>
      <td><strong>${data.probTrueGivenK[k].toFixed(4)}</strong></td>
    `;
  }
}

function updateFinalAdjTable(data) {
  const tbody = document.querySelector("#finalAdjTable tbody");
  tbody.innerHTML = "";
  for (let i = 0; i < data.finalWeightedProbs.length; i++) {
    const row = tbody.insertRow();
    row.innerHTML = `
                    <td>$${i}$</td>
                    <td>${data.posteriorProbs[i].toFixed(3)}</td>
                    <td>${data.probTrueGivenK[i].toFixed(3)}</td>
                    <td>${data.finalWeightedProbs[i].toFixed(3)}</td>
                `;
  }
}

function updateUI() {
  document.getElementById("totalDice").value = state.totalDice;
  document.getElementById("claimQuantity").value = state.claimQuantity;
  document.getElementById("claimantDice").value = state.claimantDice;
  renderDiceInput();
  renderYourDice();
  updateClaimFaceButton();
  updatePipsToggle();
  updateCalculatorView();
  updateMathView();
}

// ============== EVENT LISTENERS ==============
document.getElementById("wildOnes").addEventListener("change", (e) => {
  state.wildOnes = e.target.checked;
  console.log("Wild Ones:", state.wildOnes);
  updateUI();
});

document.getElementById("bluffRate").addEventListener("input", (e) => {
  state.bluffRate = parseInt(e.target.value) / 100;
  document.getElementById("bluffRateValue").textContent = e.target.value;
  updateUI();
});

document.getElementById("pipsToggle").addEventListener("click", () => {
  state.showPips = !state.showPips;
  updateUI();
});

// View switching
document.getElementById("navCalculator").addEventListener("click", () => {
  document.getElementById("calculatorView").classList.add("active");
  document.getElementById("mathView").classList.remove("active");
  document.getElementById("navCalculator").classList.remove("secondary");
  document.getElementById("navMath").classList.add("secondary");
});

document.getElementById("navMath").addEventListener("click", () => {
  document.getElementById("mathView").classList.add("active");
  document.getElementById("calculatorView").classList.remove("active");
  document.getElementById("navMath").classList.remove("secondary");
  document.getElementById("navCalculator").classList.add("secondary");
});

// Theme toggle
document.getElementById("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const icon = document.getElementById("themeToggle");
  icon.textContent = document.body.classList.contains("dark-mode")
    ? "☀️"
    : "🌙";
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light"
  );
});

// Load saved theme
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    document.getElementById("themeToggle").textContent = "☀️";
  }
  loadSectionState();
  initDragAndDrop();
  updateUI();
});
