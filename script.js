// --- Core Math Functions ---
// A more efficient way to calculate binomial coefficients without recursion.
function binomialCoefficient(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n / 2) k = n - k;
  let res = 1;
  for (let i = 1; i <= k; ++i) {
    res = (res * (n - i + 1)) / i;
  }
  return res;
}

// Calculates the "at least k" probability for a binomial distribution.
function binomialTail(n, p, k) {
  if (k <= 0) return 1.0;
  if (k > n) return 0.0;
  let sum = 0.0;
  for (let i = k; i <= n; i++) {
    sum +=
      binomialCoefficient(n, i) * Math.pow(p, i) * Math.pow(1.0 - p, n - i);
  }
  return sum;
}

// --- Main Probability Calculation Functions ---
// Calculates the simple, unadjusted probability of a claim being true.
// This assumes no information about the claimant's hand.
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
  const result = binomialTail(remainingDice, p, requiredCount);
  return {
    probability: result,
    yourContribution: yourContribution,
    requiredCount: requiredCount,
    remainingDice: remainingDice,
    p: p,
  };
}

// The core Bayesian calculation. This function models the probability
// of a claim being true, given a specific claimant's claim and a bluff rate.
function adjustedProbabilityJS({
  totalDice,
  yourDice,
  claimantDice,
  claimQuantity,
  claimFace,
  wildOnes,
  bluffRate,
}) {
  const p = wildOnes && claimFace !== 1 ? 2.0 / 6.0 : 1.0 / 6.0;
  const yourContribution = yourDice.filter(
    (d) => d === claimFace || (wildOnes && d === 1 && claimFace !== 1)
  ).length;
  const unknownDiceTotal = totalDice - yourDice.length;
  const restDice = unknownDiceTotal - claimantDice;
  const R = Math.max(0, claimQuantity - yourContribution);
  const threshold = Math.floor(claimantDice * p);

  // Step 1: Calculate the prior probability of each possible hand for the claimant.
  let priorProbs = [];
  for (let k = 0; k <= claimantDice; k++) {
    priorProbs.push(
      binomialCoefficient(claimantDice, k) *
        Math.pow(p, k) *
        Math.pow(1.0 - p, claimantDice - k)
    );
  }

  // Step 2: Calculate the probability of the claim, given each possible hand (with bluffing).
  const pClaimGivenK = priorProbs.map((_, k) =>
    k >= threshold ? 1.0 : bluffRate
  );
  const combinedProbs = priorProbs.map((prob, i) => prob * pClaimGivenK[i]);
  const PClaim = combinedProbs.reduce((acc, val) => acc + val, 0);

  // Step 3: Calculate the posterior probability of each hand, given the claim.
  const posteriorProbs = combinedProbs.map((prob) => prob / PClaim);

  // Step 4: Calculate the probability of the claim being true, given each possible hand.
  let probTrueGivenK = [];
  for (let k = 0; k <= claimantDice; k++) {
    const need = Math.max(0, R - k);
    probTrueGivenK.push(binomialTail(restDice, p, need));
  }

  // Step 5: Combine the posterior and "true" probabilities to get the final adjusted probability.
  const finalWeightedProbs = posteriorProbs.map(
    (prob, i) => prob * probTrueGivenK[i]
  );
  const totalProb = finalWeightedProbs.reduce((acc, val) => acc + val, 0);

  return {
    probability: totalProb,
    yourContribution: yourContribution,
    requiredCount: R,
    p: p,
    threshold: threshold,
    priorProbs: priorProbs,
    pClaimGivenK: pClaimGivenK,
    combinedProbs: combinedProbs,
    posteriorProbs: posteriorProbs,
    probTrueGivenK: probTrueGivenK,
    finalWeightedProbs: finalWeightedProbs,
    PClaim: PClaim,
    claimantDice: claimantDice,
    restDice: restDice,
  };
}

// --- DOM and Event Handling ---
// Helper to display in-page messages
function showMessage(message) {
  const messageBox = document.getElementById("alert-message");
  if (messageBox) {
    messageBox.innerText = message;
    messageBox.style.display = "block";
  }
}

// Main function to update all probability views and tables
function updateAllViews() {
  // Get all user input values
  const totalDice = parseInt(document.getElementById("totalDice").value);
  const yourDiceStr = document.getElementById("yourDice").value;
  const yourDice = yourDiceStr
    .split(",")
    .map((d) => parseInt(d.trim()))
    .filter((d) => !isNaN(d));
  const prevClaimQuantity = parseInt(
    document.getElementById("claimQuantity").value
  );
  const prevClaimFace = parseInt(document.getElementById("claimFace").value);
  const claimantDice = parseInt(document.getElementById("claimantDice").value);
  const bluffRate = parseFloat(document.getElementById("bluffRate").value);
  const wildOnes = document.getElementById("wildOnes").checked;

  // Update bluff rate value display
  const bluffRateValueElement = document.getElementById("bluffRateValue");
  if (bluffRateValueElement)
    bluffRateValueElement.innerText = `${Math.round(bluffRate * 100)}`;

  // Validation and error handling
  const validDicePattern = /^(\s*[1-6]\s*(,\s*[1-6]\s*)*)?$/;
  if (!validDicePattern.test(yourDiceStr)) {
    showMessage(
      "Invalid dice input! Enter numbers between 1 and 6, separated by commas."
    );
    return;
  }
  if (isNaN(totalDice) || totalDice < 1) {
    showMessage("Total Dice must be a positive number.");
    return;
  }
  if (isNaN(prevClaimQuantity) || prevClaimQuantity < 1) {
    showMessage("Previous Claim Quantity must be at least 1.");
    return;
  }
  if (isNaN(claimantDice) || claimantDice < 1) {
    showMessage("Claimant's Dice must be 1 or greater.");
    return;
  }
  if (yourDice.length + claimantDice > totalDice) {
    showMessage(
      "Your Dice and Claimant Dice together cannot exceed the total number of dice in play."
    );
    return;
  }
  document.getElementById("alert-message").style.display = "none";

  // Calculator View updates
  const defaultProb = calculateNormalProbability(
    prevClaimQuantity,
    prevClaimFace,
    yourDice,
    totalDice,
    wildOnes
  ).probability;
  document.getElementById("defaultClaimProbability").innerText = `${(
    defaultProb * 100
  ).toFixed(2)}%`;

  const adjustedProbnew = adjustedProbabilityJS({
    totalDice: totalDice,
    yourDice: yourDice,
    claimantDice: claimantDice,
    claimQuantity: prevClaimQuantity,
    claimFace: prevClaimFace,
    wildOnes: wildOnes,
    bluffRate: bluffRate,
  }).probability;
  document.getElementById("adjustedClaimProbabilitynew").innerText = `${(
    adjustedProbnew * 100
  ).toFixed(2)}%`;

  const nextMovesTable = document.getElementById("nextMovesTable");
  if (nextMovesTable) {
    nextMovesTable.innerHTML = "";
    for (let i = prevClaimQuantity; i <= totalDice; i++) {
      for (let j = 1; j <= 6; j++) {
        if (i === prevClaimQuantity && j <= prevClaimFace) continue;

        const probWithoutClaimant = calculateNormalProbability(
          i,
          j,
          yourDice,
          totalDice,
          wildOnes
        ).probability;
        let probWithClaimant = 0;

        const isSameFace =
          j === prevClaimFace || (wildOnes && j === 1 && prevClaimFace !== 1);

        if (isSameFace) {
          // For the same claimed face, use the full Bayesian calculation with the standard bluff rate.
          probWithClaimant = adjustedProbabilityJS({
            totalDice: totalDice,
            yourDice: yourDice,
            claimantDice: claimantDice,
            claimQuantity: i,
            claimFace: j,
            wildOnes: wildOnes,
            bluffRate: bluffRate,
          }).probability;
        } else {
          // For a different face, we model the lowered probability due to symmetry.
          // A simple linear scaling of the normal probability is a robust proxy for this.
          probWithClaimant = probWithoutClaimant * (1 - bluffRate * 0.5);
        }

        nextMovesTable.innerHTML += `
                    <tr>
                        <td>${i} x ${j}'s</td>
                        <td>${(probWithoutClaimant * 100).toFixed(2)}%</td>
                        <td>${(probWithClaimant * 100).toFixed(2)}%</td>
                    </tr>
                `;
      }
    }
  }

  // Math View updates
  const normalProb = calculateNormalProbability(
    prevClaimQuantity,
    prevClaimFace,
    yourDice,
    totalDice,
    wildOnes
  );
  const adjustedProb = adjustedProbabilityJS({
    totalDice: totalDice,
    yourDice: yourDice,
    claimantDice: claimantDice,
    claimQuantity: prevClaimQuantity,
    claimFace: prevClaimFace,
    wildOnes: wildOnes,
    bluffRate: bluffRate,
  });

  const normalStep1Info = document.getElementById("normal-step-1-info");
  if (normalStep1Info)
    normalStep1Info.innerHTML = `You have <span class="font-bold">${yourDice.join(
      ", "
    )}</span>. For a claim of <span class="font-bold">${prevClaimFace}s</span> with Wild 1s, you contribute <span class="font-bold">${
      normalProb.yourContribution
    }</span> dice.`;
  const normalStep2Info1 = document.getElementById("normal-step-2-info-1");
  if (normalStep2Info1)
    normalStep2Info1.innerHTML = `Unknown dice = Total Dice - Your Dice = ${totalDice} - ${yourDice.length} = <span class="font-bold">${normalProb.remainingDice}</span>`;
  const normalStep2Info2 = document.getElementById("normal-step-2-info-2");
  if (normalStep2Info2)
    normalStep2Info2.innerHTML = `Remaining needed = Claim - Your Contribution = ${prevClaimQuantity} - ${normalProb.yourContribution} = <span class="font-bold">${normalProb.requiredCount}</span>`;

  updateMathBlock(
    "normalFormulaGeneric",
    `\\[ P(K\\ge k) = \\sum_{i=k}^{n} \\binom{n}{i} p^i (1-p)^{n-i} \\]
                                                where: \\(n\\) is total unknown dice, \\(k\\) is required count, and \\(p\\) is probability of a match.`
  );
  updateMathBlock(
    "normalFormulaExample",
    `\\[ P(K\\ge ${normalProb.requiredCount}) = \\sum_{i=${
      normalProb.requiredCount
    }}^{${normalProb.remainingDice}} \\binom{${
      normalProb.remainingDice
    }}{i} (${normalProb.p.toFixed(3)})^i (${(1 - normalProb.p).toFixed(3)})^{${
      normalProb.remainingDice
    } - i} \\]`
  );
  updateNormalTable(
    "normalTable",
    normalProb.remainingDice,
    normalProb.requiredCount,
    normalProb.p
  );
  const finalNormalProbability = document.getElementById(
    "finalNormalProbability"
  );
  if (finalNormalProbability)
    finalNormalProbability.innerText = `✅ Final Normal Probability: ${(
      normalProb.probability * 100
    ).toFixed(2)}%`;

  const adjStep1Info = document.getElementById("adj-step-1-info");
  if (adjStep1Info)
    adjStep1Info.innerHTML = `You have <span class="font-bold">${yourDice.join(
      ", "
    )}</span>. With wild 1s, you contribute <span class="font-bold">${
      adjustedProb.yourContribution
    }</span> to the claim of ${prevClaimQuantity} ${prevClaimFace}'s. Remaining needed from other players: <span class="font-bold">${
      adjustedProb.requiredCount
    }</span>.`;

  const adjStep2NElement = document.getElementById("adj-step2-n");
  if (adjStep2NElement) {
    adjStep2NElement.innerText = adjustedProb.claimantDice;
  }

  updateMathBlock(
    "priorFormulaGeneric",
    `\\[ P(K=k) = \\binom{n_c}{k} p^k (1-p)^{n_c-k} \\]
                                                where: \\(n_c\\) is claimant's dice, \\(k\\) is matches, and \\(p\\) is match probability.`
  );
  updatePriorTable("priorTable", adjustedProb);

  const adjStep3Threshold = document.getElementById("adj-step3-threshold");
  if (adjStep3Threshold) {
    adjStep3Threshold.innerHTML = `Expected Matches \\(E[K] = n_c \\cdot p = ${
      adjustedProb.claimantDice
    } \\cdot ${adjustedProb.p.toFixed(3)} = ${(
      adjustedProb.claimantDice * adjustedProb.p
    ).toFixed(
      2
    )}\\). The bluffing threshold is \\(\\lfloor E[K] \\rfloor = \\lfloor ${(
      adjustedProb.claimantDice * adjustedProb.p
    ).toFixed(2)} \\rfloor = ${adjustedProb.threshold}.\\)`;
  }
  updateMathBlock(
    "posteriorFormulaGeneric",
    `\\[ P(K=k | \\text{claim}) = \\frac{P(\\text{claim}|K=k) \\cdot P(K=k)}{P(\\text{claim})} \\]`
  );
  updatePosteriorTable("posteriorTable", adjustedProb);

  updateMathBlock(
    "adj-step5-formula-generic",
    `\\[ P(\\text{claim true}|K=k) = \\sum_{j=R-k}^{n_u} \\binom{n_u}{j} p^j (1-p)^{n_u - j} \\]
                                                where: \\(n_u\\) is remaining unknown dice, \\(R\\) is remaining matches needed from other players.`
  );
  updateProbTrueTable("adj-prob-true-table", adjustedProb);

  updateMathBlock(
    "finalAdjFormulaGeneric",
    `\\[ \\text{Adjusted Probability} = \\sum_{k=0}^{n_c} P(K=k | \\text{claim}) \\cdot P(\\text{claim true} | K=k) \\]`
  );
  updateFinalAdjTable("finalAdjTable", adjustedProb);
  const finalAdjustedProbability = document.getElementById(
    "finalAdjustedProbability"
  );
  if (finalAdjustedProbability)
    finalAdjustedProbability.innerText = `✅ Final Adjusted Probability: ${(
      adjustedProb.probability * 100
    ).toFixed(2)}%`;

  if (window.MathJax) {
    window.MathJax.typesetPromise();
  }
}

// Helper to update the MathJax blocks
function updateMathBlock(blockId, formula) {
  const block = document.getElementById(blockId);
  if (block) block.innerHTML = formula;
}

function updateNormalTable(tableId, n, startK, p) {
  const tableBody = document.querySelector(`#${tableId} tbody`);
  if (!tableBody) return;
  tableBody.innerHTML = "";
  for (let k = startK; k <= n; k++) {
    const term =
      binomialCoefficient(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
    const formula = `\\binom{${n}}{${k}} \\cdot (${p.toFixed(
      3
    )})^{${k}} \\cdot (${(1 - p).toFixed(3)})^{${n} - ${k}}`;

    const row = tableBody.insertRow();
    row.insertCell(0).innerHTML = `\\(${k}\\)`;
    const formulaCell = row.insertCell(1);
    formulaCell.innerHTML = `\\[${formula}\\]`;
    row.insertCell(2).innerText = term.toFixed(5);
  }
}

function updatePriorTable(tableId, data) {
  const priorTableBody = document.querySelector(`#${tableId} tbody`);
  if (!priorTableBody) return;
  priorTableBody.innerHTML = "";
  for (let i = 0; i < data.priorProbs.length; i++) {
    const row = priorTableBody.insertRow();
    row.insertCell(0).innerHTML = `\\(${i}\\)`;
    const formula = `\\binom{${
      data.claimantDice
    }}{${i}} \\cdot (${data.p.toFixed(3)})^{${i}} \\cdot (${(
      1 - data.p
    ).toFixed(3)})^{${data.claimantDice} - ${i}}`;
    const formulaCell = row.insertCell(1);
    formulaCell.innerHTML = `\\[${formula}\\]`;
    row.insertCell(2).innerText = data.priorProbs[i].toFixed(3);
  }
}

function updatePosteriorTable(tableId, data) {
  const posteriorTableBody = document.querySelector(`#${tableId} tbody`);
  if (!posteriorTableBody) return;
  posteriorTableBody.innerHTML = "";
  for (let i = 0; i < data.posteriorProbs.length; i++) {
    const row = posteriorTableBody.insertRow();
    row.insertCell(0).innerHTML = `\\(${i}\\)`;
    const formula = `\\frac{${(
      data.priorProbs[i] * data.pClaimGivenK[i]
    ).toFixed(3)}}{${data.PClaim.toFixed(3)}}`;
    const formulaCell = row.insertCell(1);
    formulaCell.innerHTML = `\\[${formula}\\]`;
    row.insertCell(2).innerText = data.posteriorProbs[i].toFixed(3);
  }
}

function updateProbTrueTable(tableId, data) {
  const adjProbTrueTableBody = document.querySelector(`#${tableId} tbody`);
  if (!adjProbTrueTableBody) return;
  adjProbTrueTableBody.innerHTML = "";
  for (let i = 0; i < data.probTrueGivenK.length; i++) {
    const row = adjProbTrueTableBody.insertRow();
    row.insertCell(0).innerHTML = `\\(${i}\\)`;
    const needed = Math.max(0, data.requiredCount - i);
    const formula =
      i >= data.requiredCount
        ? "1.0"
        : `\\sum_{j=${needed}}^{${data.restDice}} \\binom{${
            data.restDice
          }}{j} (${data.p.toFixed(3)})^j (${(1 - data.p).toFixed(3)})^{${
            data.restDice
          }-j}`;
    const formulaCell = row.insertCell(1);
    formulaCell.innerHTML = `\\[${formula}\\]`;
    row.insertCell(2).innerText = data.probTrueGivenK[i].toFixed(3);
  }
}

function updateFinalAdjTable(tableId, data) {
  const finalAdjTableBody = document.querySelector(`#${tableId} tbody`);
  if (!finalAdjTableBody) return;
  finalAdjTableBody.innerHTML = "";
  for (let i = 0; i < data.finalWeightedProbs.length; i++) {
    const row = finalAdjTableBody.insertRow();
    row.insertCell(0).innerHTML = `\\(${i}\\)`;
    row.insertCell(1).innerText = data.posteriorProbs[i].toFixed(3);
    row.insertCell(2).innerText = data.probTrueGivenK[i].toFixed(3);
    row.insertCell(3).innerText = data.finalWeightedProbs[i].toFixed(3);
  }
}

// --- View Switching and Initial Call ---
// Hook up the buttons to switchView
document
  .getElementById("showCalculator")
  .addEventListener("click", () => switchView("calculatorView"));
document
  .getElementById("showMath")
  .addEventListener("click", () => switchView("mathView"));
document
  .getElementById("showAbout")
  .addEventListener("click", () => switchView("aboutView"));

function switchView(viewId) {
  const views = ["calculatorView", "mathView", "aboutView"];
  const navButtons = {
    calculatorView: "showCalculator",
    mathView: "showMath",
    aboutView: "showAbout",
  };

  const inputCard = document.getElementById("inputParamsCard");
  if (inputCard) {
    inputCard.classList.toggle("hidden", viewId === "aboutView");
  }

  views.forEach((view) => {
    const viewElement = document.getElementById(view);
    if (viewElement) viewElement.classList.add("hidden");
    const buttonElement = document.getElementById(navButtons[view]);
    if (buttonElement) {
      buttonElement.classList.remove("btn-primary");
      buttonElement.classList.add("btn-secondary");
    }
  });

  const targetViewElement = document.getElementById(viewId);
  if (targetViewElement) targetViewElement.classList.remove("hidden");
  const targetButtonElement = document.getElementById(navButtons[viewId]);
  if (targetButtonElement) {
    targetButtonElement.classList.remove("btn-secondary");
    targetButtonElement.classList.add("btn-primary");
  }

  if (window.MathJax) {
    window.MathJax.typesetPromise();
  }
}

// Theme Toggle Logic
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const htmlElement = document.documentElement;
    const currentTheme = htmlElement.getAttribute("data-bs-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    htmlElement.setAttribute("data-bs-theme", newTheme);
    const themeIcon = themeToggle.querySelector("i");
    if (themeIcon) {
      themeIcon.className =
        newTheme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-fill";
    }
  });
}

// Initial call and event listeners
document.addEventListener("DOMContentLoaded", () => {
  const inputs = [
    "yourDice",
    "totalDice",
    "claimQuantity",
    "claimFace",
    "claimantDice",
    "wildOnes",
    "bluffRate",
  ];

  inputs.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("input", updateAllViews);
    }
  });

  // Set initial active view
  switchView("calculatorView");
  updateAllViews();
});
