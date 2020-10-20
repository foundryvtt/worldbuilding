/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { SimpleActor } from "./actor.js";
import { SimpleItemSheet } from "./item-sheet.js";
import { SimpleActorSheet } from "./actor-sheet.js";
import { preloadHandlebarsTemplates } from "./templates.js";
import { createWorldbuildingMacro } from "./macro.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

/**
 * Init hook.
 */
Hooks.once("init", async function() {
  console.log(`Initializing Simple Worldbuilding System`);

  /**
   * Set an initiative formula for the system. This will be updated later.
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d20",
    decimals: 2
  };

  game.worldbuilding = {
    SimpleActor,
    createWorldbuildingMacro
  };

  // Define custom Entity classes
  CONFIG.Actor.entityClass = SimpleActor;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("worldbuilding", SimpleActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("worldbuilding", SimpleItemSheet, { makeDefault: true });

  // Register system settings
  game.settings.register("worldbuilding", "macroShorthand", {
    name: "SETTINGS.SimpleMacroShorthandN",
    hint: "SETTINGS.SimpleMacroShorthandL",
    scope: "world",
    type: Boolean,
    default: true,
    config: true
  });

  // Register initiative setting.
  game.settings.register("worldbuilding", "initFormula", {
    name: "SETTINGS.SimpleInitFormulaN",
    hint: "SETTINGS.SimpleInitFormulaL",
    scope: "world",
    type: String,
    default: "1d20",
    config: true,
    onChange: formula => _simpleUpdateInit(formula, true)
  });

  // Retrieve and assign the initiative formula setting.
  const initFormula = game.settings.get("worldbuilding", "initFormula");
  _simpleUpdateInit(initFormula);

  /**
   * Update the initiative formula.
   * @param {string} formula - Dice formula to evaluate.
   * @param {boolean} notify - Whether or not to post nofications.
   */
  function _simpleUpdateInit(formula, notify = false) {
    // If the formula is valid, use it.
    try {
      new Roll(formula).roll();
      CONFIG.Combat.initiative.formula = formula;
      if (notify) {
        ui.notifications.notify(game.i18n.localize("SIMPLE.NotifyInitFormulaUpdated") + ` ${formula}`);
      }
    }
    // Otherwise, fall back to a d20.
    catch (error) {
      CONFIG.Combat.initiative.formula = "1d20";
      if (notify) {
        ui.notifications.error(game.i18n.localize("SIMPLE.NotifyInitFormulaInvalid") + ` ${formula}`);
      }
    }
  }

  /**
   * Slugify a string.
   */
  Handlebars.registerHelper('slugify', function(value) {
    return value.slugify({strict: true});
  });

  // Preload template partials.
  preloadHandlebarsTemplates();
});

/**
 * Macrobar hook.
 */
Hooks.on("hotbarDrop", (bar, data, slot) => createWorldbuildingMacro(data, slot));

/**
 * Adds the actor template context menu.
 */
Hooks.on("getActorDirectoryEntryContext", (html, options) => {
  // Define an actor as a template.
  options.push({
    name: game.i18n.localize("SIMPLE.DefineTemplate"),
    icon: '<i class="fas fa-stamp"></i>',
    condition: li => {
      const actor = game.actors.get(li.data("entityId"));
      return !actor.getFlag("worldbuilding", "isTemplate");
    },
    callback: li => {
      const actor = game.actors.get(li.data("entityId"));
      actor.setFlag("worldbuilding", "isTemplate", true);
    }
  });

  // Undefine an actor as a template.
  options.push({
    name: game.i18n.localize("SIMPLE.UnsetTemplate"),
    icon: '<i class="fas fa-times"></i>',
    condition: li => {
      const actor = game.actors.get(li.data("entityId"));
      return actor.getFlag("worldbuilding", "isTemplate");
    },
    callback: li => {
      const actor = game.actors.get(li.data("entityId"));
      actor.setFlag("worldbuilding", "isTemplate", false);
    }
  });
});

/**
 * Adds the item template context menu.
 */
Hooks.on("getItemDirectoryEntryContext", (html, options) => {
  // Define an item as a template.
  options.push({
    name: game.i18n.localize("SIMPLE.DefineTemplate"),
    icon: '<i class="fas fa-stamp"></i>',
    condition: li => {
      const item = game.items.get(li.data("entityId"));
      return !item.getFlag("worldbuilding", "isTemplate");
    },
    callback: li => {
      const item = game.items.get(li.data("entityId"));
      item.setFlag("worldbuilding", "isTemplate", true);
    }
  });

  // Undefine an item as a template.
  options.push({
    name: game.i18n.localize("SIMPLE.UnsetTemplate"),
    icon: '<i class="fas fa-times"></i>',
    condition: li => {
      const item = game.items.get(li.data("entityId"));
      return item.getFlag("worldbuilding", "isTemplate");
    },
    callback: li => {
      const item = game.items.get(li.data("entityId"));
      item.setFlag("worldbuilding", "isTemplate", false);
    }
  });
});


async function _onCreateEntity(event) {
  event.preventDefault();
  event.stopPropagation();
  return _simpleDirectoryTemplates(this, event);
}
ActorDirectory.prototype._onCreateEntity = _onCreateEntity; // For 0.7.x+
ItemDirectory.prototype._onCreateEntity = _onCreateEntity;
ActorDirectory.prototype._onCreate = _onCreateEntity; // TODO: for 0.6.6
ItemDirectory.prototype._onCreate = _onCreateEntity;

/**
 * Display the entity template dialog.
 *
 * Helper function to display a dialog if there are multiple template types defined for the entity type.
 * TODO: Refactor in 0.7.x to play more nicely with the Entity.createDialog method
 *1
 * @param {EntityCollection} entityType - The sidebar tab
 * @param {MouseEvent} event - Triggering event
 */
async function _simpleDirectoryTemplates(collection, event) {

  // Retrieve the collection and find any available templates
  const entityCollection = collection.tabName === "actors" ? game.actors : game.items;
  const cls = collection.tabName === "actors" ? Actor : Item;
  let templates = entityCollection.filter(a => a.getFlag("worldbuilding", "isTemplate"));
  let ent = game.i18n.localize(cls.config.label);

  // Setup default creation data
  let type = collection.tabName === "actors" ? 'character' : 'item';
  let createData = {
    name: `${game.i18n.localize("SIMPLE.New")} ${ent}`,
    type: type,
    folder: event.currentTarget.dataset.folder
  };
  if ( !templates.length ) return cls.create(createData, {renderSheet: true});

  // Build an array of types for the form, including an empty default.
  let types = [{
    value: null,
    label: game.i18n.localize("SIMPLE.NoTemplate")
  }].concat(templates.map(a => { return { value: a.id, label: a.name } }));

  // Render the confirmation dialog window
  const templateData = {upper: ent, lower: ent.toLowerCase(), types: types};
  const dlg = await renderTemplate(`systems/worldbuilding/templates/sidebar/entity-create.html`, templateData);
  return Dialog.confirm({
    title: `${game.i18n.localize("SIMPLE.Create")} ${createData.name}`,
    content: dlg,
    yes: html => {
      const form = html[0].querySelector("form");
      const template = entityCollection.get(form.type.value);
      if ( template ) {
        createData = mergeObject(template.data, createData, {inplace: false});
        createData.type = template.data.type;
        delete createData.flags.worldbuilding.isTemplate;
      }
      createData.name = form.name.value;
      return cls.create(createData, {renderSheet: true});
    },
    no: () => {},
    defaultYes: false
  });
}