/**
 * Create a Macro from an attribute drop.
 * Get an existing worldbuilding macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
export async function createWorldbuildingMacro(data, slot) {
  const item = data;

  // Create the macro command
  const command = `game.worldbuilding.rollAttrMacro("${item.label}", "${item.roll}");`;
  let macro = game.macros.entities.find(m => (m.name === item.label) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.label,
      type: "script",
      command: command,
      flags: { "worldbuilding.attrMacro": true }
    });
  }

  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
export function rollAttrMacro(attrName, attrFormula) {
  let actor;
  // Get the speaker and actor if not provided.
  const speaker = ChatMessage.getSpeaker({ actor: this.actor });
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);

  // Create the roll.
  let r = new Roll(attrFormula, actor.getRollData());
  r.roll().toMessage({
    user: game.user._id,
    speaker: speaker,
    flavor: attrName
  });
}