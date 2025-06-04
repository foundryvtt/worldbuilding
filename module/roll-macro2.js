game.dice3d.addColorset({
    name: "Hope",
    category: " Hope Die",
    description: "Hope",
    texture: "ice",
    foreground: "#ffbb00",
    background: "#ffffff",
    outline: "#000000",
    edge: "#ffbb00",
    material: "glass",
    font: "Modesto Condensed",
})
game.dice3d.addColorset({
    name: "Fear",
    category: " Fear Die",
    description: "Fear",
    texture: "fire",
    foreground: "#FFFFFF",
    background: "#523333",
    outline: "#b30012",
    edge: "#800013",
    material: "metal",
    font: "Modesto Condensed",
})

const buttons = ["Advantage", "Normal", "Disadvantage"].reduce((acc, action) => {
    acc[action] = { label: action.capitalize(), callback };
    return acc;
}, {});

function callback([html], event) {
    const action = event.currentTarget.dataset.button;
    const result = {
        Normal: { formula: "1d12", flavor: "", hasAdvantage: null },
        Advantage: { formula: "2d12kh", flavor: "Advantage", hasAdvantage: true },
        Disadvantage: { formula: "2d12kl", flavor: "Disadvantage", hasAdvantage: false },
    }[action] ?? { formula: "", flavor: "", hasAdvantage: null };
    return result;
}

const { formula: hopeDie, flavor: rollFlavor, hasAdvantage } = await Dialog.wait({ buttons, close: () => ({ formula: "", flavor: "", isAdvantage: null }) });
if (!hopeDie) { return; }
const roll = await new Roll(`${hopeDie} + 1d12`).roll();
const whiteDice = roll.dice[0];
const blackDice = roll.dice[1];

// Get the correct result based on the modifier also for advantage/disadvantage
const whiteDiceResult = whiteDice.values[0];
const blackDiceResult = blackDice.values[0];

// Get the correct individual white dice result
const whiteDiceVal1 = whiteDice.results[0]?.result;
const whiteDiceVal2 = whiteDice.results[1]?.result || null;

// Set the color flavors
whiteDice.options.flavor = "Hope";
blackDice.options.flavor = "Fear";

const isCrit = whiteDiceResult === blackDiceResult;
const isCritVal1 = whiteDiceVal1 === blackDiceResult;
const isCritVal2 = whiteDiceVal2 === blackDiceResult;
const isHope = whiteDiceResult > blackDiceResult;
const isFear = whiteDiceResult < blackDiceResult;


if (hasAdvantage === true){
    roll.toMessage({
        speaker: ChatMessage.getSpeaker({ token: actor }),
        flavor:
        isCrit ? `${rollFlavor} Critical success!`
        : isCritVal1 ? `${rollFlavor} Critical success (1st Hope)!`
        : isCritVal2 ? `${rollFlavor} Critical success (2nd Hope)!`
        : isHope ? `${rollFlavor} Rolled with Hope!`
        : isFear ? `${rollFlavor} Rolled with Fear!`
        : "",
    });

} else {
    roll.toMessage({
        speaker: ChatMessage.getSpeaker({ token: actor }),
        flavor:
        isCrit ? `${rollFlavor} Critical success!`
        : isHope ? `${rollFlavor} Rolled with Hope!`
        : isFear ? `${rollFlavor} Rolled with Fear!`
        : "",
    });
}



