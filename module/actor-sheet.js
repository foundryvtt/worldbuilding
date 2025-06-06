import { EntitySheetHelper } from "./helper.js";
import {ATTRIBUTE_TYPES} from "./constants.js";

/**
* Extend the basic ActorSheet with some very simple modifications
* @extends {ActorSheet}
*/
export class SimpleActorSheet extends foundry.appv1.sheets.ActorSheet {
  
  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["worldbuilding", "sheet", "actor"],
      template: "systems/worldbuilding/templates/actor-sheet.html",
      width: 560,
      height: 980,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".biography", ".items", ".attributes"],
      dragDrop: [
        { dragSelector: ".item-list .item", dropSelector: null },
        { dragSelector: ".card", dropSelector: ".domains-section" }
      ]
    });
  }
  
  /* -------------------------------------------- */
  
  /** @inheritdoc */
  async getData(options) {
    const context = await super.getData(options);
    EntitySheetHelper.getAttributeData(context.data);
    context.shorthand = !!game.settings.get("worldbuilding", "macroShorthand");
    context.systemData = context.data.system;
    context.domains = this.actor.system.domains;
    context.dtypes = ATTRIBUTE_TYPES;
    
    // htmlFields
    context.biographyHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.biography, {
      secrets: this.document.isOwner,
      async: true
    });
    context.inventoryHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.inventory, {
      secrets: this.document.isOwner,
      async: true
    });
    /*context.agilityHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.agility.tooltip, {
      secrets: this.document.isOwner,
      async: true
    });
    context.strengthHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.strength.tooltip, {
      secrets: this.document.isOwner,
      async: true
    });
    context.finesseHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.finesse.tooltip, {
      secrets: this.document.isOwner,
      async: true
    });
    context.instinctHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.instinct.tooltip, {
      secrets: this.document.isOwner,
      async: true
    });
    context.presenceHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.presence.tooltip, {
      secrets: this.document.isOwner,
      async: true
    });
    context.knowledgeHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.knowledge.tooltip, {
      secrets: this.document.isOwner,
      async: true
    }); */
    
    context.actor = this.actor; // Add this line to include the actor object in the context
    
    const imageLink = context.data.img;
    context.imageStyle = `background: url(${imageLink});`;
    
    return context;
  }
  
  /* -------------------------------------------- */
  
  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Everything below here is only needed if the sheet is editable
    if ( !this.isEditable ) return;
    
    // Attribute Management
    html.find(".attributes").on("click", ".attribute-control", EntitySheetHelper.onClickAttributeControl.bind(this));
    html.find(".groups").on("click", ".group-control", EntitySheetHelper.onClickAttributeGroupControl.bind(this));
    html.find(".attributes").on("click", "a.attribute-roll", EntitySheetHelper.onAttributeRoll.bind(this));
    
    //Clickable Labels Block
    html.find(".traits").on("click", ".trait label", this._onTraitLabelClick.bind(this));
    //html.find(".weapon-group").on("click", ".weapon-label", this._onWeaponLabelClick.bind(this));
    html.find(".click-rollable-group").on("click", ".click-rollable", this._onRollableClick.bind(this));
    html.find(".basic-rollable-group").on("click", ".basic-rollable", this._onBasicRollableClick.bind(this));
    
    // Item Controls
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".rollable").on("click", this._onItemRoll.bind(this));
    
    
    //Cards System
    html.find('.remove-card').click(this._onRemoveCard.bind(this));
    
    // Add draggable for Macro creation
    html.find(".attributes a.attribute-roll").each((i, a) => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        let dragData = ev.currentTarget.dataset;
        ev.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      }, false);
    });
    
    
    // Dealing with Input width
    let el = html.find(".input-wrap .input");
    let widthMachine = html.find(".input-wrap .width-machine");
    el.on("keyup", () => {
      widthMachine.html(el.val());
    });
    
    // Dealing with Textarea Height
    function calcHeight(value) {
      let numberOfLineBreaks = (value.match(/\n/g) || []).length;
      // min-height + lines x line-height + padding + border
      let newHeight = 20 + numberOfLineBreaks * 20 + 12 + 2;
      return newHeight;
    }
    
    let textarea = html.find(".resize-ta");
    textarea.on("keyup", () => {
      textarea.css("height", calcHeight(textarea.val()) + "px");
    });
  }
  
  /* -------------------------------------------- */
  
  /**
  * Handle click events for Item control buttons within the Actor Sheet
  * @param event
  * @private
  */
  _onItemControl(event) {
    event.preventDefault();
    
    // Obtain event data
    const button = event.currentTarget; // This is the element with data-action, e.g., the <img> or <a>
    const li = button.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    const action = button.dataset.action;

    // If the clicked element is an IMG with data-action="edit" (the item's image)
    if (item && action === "edit" && button.tagName === 'IMG' && button.classList.contains('item-control')) {
      const chatMessage = `@UUID[${item.uuid}]{${item.name}}`;
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: chatMessage
      });
      return; // Done, don't proceed to open edit sheet or other actions
    }
    
    const type = button.dataset.type; // Ensure type is read for create actions
    
    switch (action) {
      case "create":
      const clsi = getDocumentClass("Item");
      return clsi.create({name: "New Feature", type: type}, {parent: this.actor}); // Use the type variable here
      case "create-item":
      const cls = getDocumentClass("Item");
      return cls.create({name: "New Item", type: type}, {parent: this.actor}); // Use the type variable here
      case "create-domain":
      const clsd = getDocumentClass("Item");
      return clsd.create({name: "New Domain", type: type}, {parent: this.actor}); // Use the type variable here
      case "edit": // This will now only be reached if the image wasn't clicked (e.g., edit icon was clicked)
        if (item) return item.sheet.render(true);
        break;
      case "delete":
        if (item) return item.delete();
        break;
    }
  }
  
  /* -------------------------------------------- */
  
  /**
  * Listen for roll buttons on items.
  * @param {MouseEvent} event    The originating left click event
  */
  async _onItemRoll(event) {
    console.log("this is being called");
    let button = $(event.currentTarget);
    const li = button.parents(".item");
    const item = this.actor.items.get(li.data("itemId"));
    let r = new Roll(button.data('roll'), this.actor.getRollData());
    return await r.toMessage({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h4>${item.name}</h4><a>${button.text()}</a>`
    });
  }
  
  /* -------------------------------------------- */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    
    if (data.type === "Card") {
      event.preventDefault();
      const card = await fromUuid(data.uuid);
      const domains = this.actor.system.domains || [];
      const newCardId = foundry.utils.randomID(); // Generate a unique ID for the new card instance
      domains.push({ _id: newCardId, name: card.name, img: card.img });
      await this.actor.update({"system.domains": domains});
      return;
    }
    
    super._onDrop(event);
  }
  
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    const targetList = event.target.closest('.item-list');
    if (!targetList) return false;

    const newType = targetList.dataset.itemType;
    if (!newType) return false;

    const item = await Item.implementation.fromDropData(data);
    const itemData = item.toObject();

    // If the item comes from the same actor, we are moving it.
    if (this.actor.items.has(itemData._id)) {
      // Update the existing item's type
      return this.actor.updateEmbeddedDocuments("Item", [{ _id: itemData._id, 'system.type': newType, type: newType}]);
    } else {
      // Otherwise, we are creating a new item
      itemData.type = newType;
      itemData.system.type = newType;
      return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }
  }
  /* -------------------------------------------- */
  
  
  async _onRemoveCard(event) {
    event.preventDefault();
    const cardId = event.currentTarget.dataset.cardId;
    const domains = this.actor.system.domains || [];
    const updatedDomains = domains.filter(domain => domain._id !== cardId);
    await this.actor.update({"system.domains": updatedDomains});
  }
  
  /* -------------------------------------------- */
  
  
  /** @inheritdoc */
  _getSubmitData(updateData) {
    let formData = super._getSubmitData(updateData);
    
    
    formData = EntitySheetHelper.updateAttributes(formData, this.object);
    formData = EntitySheetHelper.updateGroups(formData, this.object);
    return formData;
  }
  
  /* -------------------------------------------- */
  
  
  async _onTraitLabelClick(event) {
    event.preventDefault();
    const traitName = event.currentTarget.closest(".trait").dataset.trait;
    const traitValue = this.actor.system[traitName].value;
    await this._rollTrait(traitName, traitValue);
  }
  
  /*async _onWeaponLabelClick(event) {
    event.preventDefault();
    
    // Identify if it's the primary or secondary weapon
    const weaponLabel = event.currentTarget.textContent.trim().toLowerCase(); // "primary" or "secondary"
    // Extract weapon name and to-hit value
    
    const weaponName = weaponLabel === "primary" ? "Primary Weapon" : "Secondary Weapon";
    const weaponPrefix = weaponLabel === "primary" ? "weapon-main" : "weapon-off";
    
    
    const weaponToHit = this.actor.system[weaponPrefix]['to-hit'];
    
    // Assuming _rollWeapon is a method to handle the weapon roll
    await this._rollTrait(weaponName, weaponToHit);
  }*/
  
  async _onRollableClick(event) {
    event.preventDefault();
    
    const rollableElement = event.currentTarget;
    const weaponBox = rollableElement.closest(".click-rollable-group");
    
    const rollNameInput = weaponBox.querySelector(".click-rollable-name");
    const rollModifierElement = weaponBox.querySelector(".click-rollable-modifier");
    
    const rollName = rollNameInput ? rollNameInput.value.trim() : "";
    const rollModifier = rollModifierElement ? parseInt(rollModifierElement.value) || 0 : 0;
    
    // Assuming _rollTrait is a method to handle the trait roll
    await this._rollTrait(rollName, rollModifier);
  }
  
  async _onBasicRollableClick(event) {
    event.preventDefault();
    
    const rollableElement = event.currentTarget;
    const rollableGroup = rollableElement.closest(".basic-rollable-group");
    const rollNameInput = rollableGroup.querySelector(".basic-rollable-name");
    const rollValueInput = rollableGroup.querySelector(".basic-rollable-value");
    console.log("Current value: ", rollableGroup.querySelector(".basic-rollable-value"));
    
    const rollName = rollNameInput.value;
    const rollValue = rollValueInput.value;
    
    await this._rollBasic(rollName, rollValue);
  }
  
  /* -------------------------------------------- */
  
  async _rollBasic(basicName, basicValue) {
    console.log("Current value: ", basicValue);
    
    const roll = new Roll(basicValue);
    
    await roll.toMessage({
      flavor: basicName,
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      rollMode: "roll"
    });
  }
  
  async _rollTrait(traitName, traitValue) {
    const traitNamePrint = traitName.charAt(0).toUpperCase()+traitName.slice(1);

    if (game.dice3d) {
      game.dice3d.addColorset({
        name: "Hope",
        category: "Hope Die",
        description: "Hope",
        texture: "ice",
        foreground: "#ffbb00",
        background: "#ffffff",
        outline: "#000000",
        edge: "#ffbb00",
        material: "glass",
        font: "Modesto Condensed",
      });
      game.dice3d.addColorset({
        name: "Fear",
        category: "Fear Die",
        description: "Fear",
        texture: "fire",
        foreground: "#FFFFFF",
        background: "#523333",
        outline: "#b30012",
        edge: "#800013",
        material: "metal",
        font: "Modesto Condensed",
      });
      game.dice3d.addColorset({
        name: "Modifier",
        category: "Modifier Die",
        description: "Modifier",
        texture: "marble",
        foreground: "#222222",
        background: "#DDDDDD",
        outline: "#000000",
        edge: "#555555",
        material: "plastic",
        font: "Arial",
      });
    }

    const buttons = {
      AdvantageButton: {
        label: "Advantage",
        icon: "<i class=\'fas fa-plus-circle\'></i>",
        callback: () => ({ coreFormula: "1d12 + 1d12 + 1d6", flavorSuffix: "Advantage", rollType: "Advantage" })
      },
      NormalButton: {
        label: "Normal",
        icon: "<i class=\'fas fa-dice-d20\'></i>",
        callback: () => ({ coreFormula: "1d12 + 1d12", flavorSuffix: "", rollType: "Normal" })
      },
      DisadvantageButton: {
        label: "Disadvantage",
        icon: "<i class=\'fas fa-minus-circle\'></i>",
        callback: () => ({ coreFormula: "1d12 + 1d12 - 1d6", flavorSuffix: "Disadvantage", rollType: "Disadvantage" })
      }
    };

    const dialogChoice = await Dialog.wait({
      title: `${traitNamePrint} Roll`,
      content: `<p>Choose roll type for ${traitNamePrint} (Base Modifier: ${traitValue}):</p>`,
      buttons,
      default: "NormalButton",
      close: () => null
    });

    if (!dialogChoice) { return; } 

    const { coreFormula, flavorSuffix: rollFlavorFromDialog, rollType } = dialogChoice;
    const fullRollFormula = `${coreFormula} + ${traitValue}`;
    const roll = await new Roll(fullRollFormula).roll();

    let whiteDiceResult, blackDiceResult;
    let d12_A_val, d12_B_val;

    if (roll.dice.length >= 2) {
      // First d12 (Hope D12 component)
      roll.dice[0].options.flavor = "Hope";
      d12_A_val = roll.dice[0].total;

      // Second d12 (Fear D12 component)
      roll.dice[1].options.flavor = "Fear";
      d12_B_val = roll.dice[1].total;

      // Initialize comparison values based on the two primary d12s
      whiteDiceResult = d12_A_val;
      blackDiceResult = d12_B_val;

      // Adjust whiteDiceResult based on Advantage/Disadvantage modifier d6
      if (rollType === "Advantage" && roll.dice.length >= 3) {
        const d6_term = roll.dice[2];
        d6_term.options.flavor = "Modifier";
        whiteDiceResult += d6_term.total; 
      } else if (rollType === "Disadvantage" && roll.dice.length >= 3) {
        const d6_term = roll.dice[2];
        d6_term.options.flavor = "Modifier";
        // d6_term.total will be positive; explicit subtraction for comparison value
        whiteDiceResult -= d6_term.total; 
      } else if ((rollType === "Advantage" || rollType === "Disadvantage") && roll.dice.length < 3) {
        // This case should ideally not be reached if coreFormula is set correctly
        console.warn(`Worldbuilding | ${rollType} roll for ${traitNamePrint} expected a modifier d6 but it was not found in roll terms. Proceeding with unmodified Hope D12 result for comparison.`);
      }
    } else {
      console.error(`Worldbuilding | Critical error during ${traitNamePrint} roll: Less than two primary dice terms found. Roll object:`, roll);
      return; // Cannot proceed with comparison
    }

    const isCrit = whiteDiceResult === blackDiceResult;
    const isHope = whiteDiceResult > blackDiceResult;
    const isFear = whiteDiceResult < blackDiceResult;

    let finalFlavor = `${traitNamePrint}`;
    if (rollFlavorFromDialog) {
      finalFlavor += ` ${rollFlavorFromDialog}`;
    }

    if (isCrit) {
      finalFlavor += ` Critical Success!`;
    } else if (isHope) {
      finalFlavor += ` Rolled with Hope!`;
    } else if (isFear) {
      finalFlavor += ` Rolled with Fear!`;
    }
    
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ token: this.actor }),
      flavor: finalFlavor
    });
  }
}


/**
* Extend the basic ActorSheet with some very simple modifications
* @extends {ActorSheet}
*/
export class NPCActorSheet extends SimpleActorSheet {
  
  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["worldbuilding", "sheet", "npc"],
      template: "systems/worldbuilding/templates/actor-sheet-npc.html",
      width: 650,
      height: 840,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "experience"}],
      scrollY: [".biography", ".items", ".attributes"],
      dragDrop: [
        { dragSelector: ".item-list .item", dropSelector: null },
        { dragSelector: ".card", dropSelector: ".domains-section" }
      ]
    });
  }
  
  /* -------------------------------------------- */
  
  /** @inheritdoc */
  async getData(options) {
    const context = await super.getData(options);
    EntitySheetHelper.getAttributeData(context.data);
    context.shorthand = !!game.settings.get("worldbuilding", "macroShorthand");
    context.systemData = context.data.system;
    context.domains = this.actor.system.domains;
    context.dtypes = ATTRIBUTE_TYPES;
    
    // htmlFields
    context.biographyHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.biography, {
      secrets: this.document.isOwner,
      async: true
    });
    context.inventoryHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(context.systemData.inventory, {
      secrets: this.document.isOwner,
      async: true
    });
    
    
    context.actor = this.actor; // Add this line to include the actor object in the context
    
    const imageLink = context.data.img;
    context.imageStyle = `background: url(${imageLink});`;
    
    return context;
  }
  
  /* -------------------------------------------- */
  
  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Everything below here is only needed if the sheet is editable
    if ( !this.isEditable ) return;
    
    // Attribute Management
    html.find(".attributes").on("click", ".attribute-control", EntitySheetHelper.onClickAttributeControl.bind(this));
    html.find(".groups").on("click", ".group-control", EntitySheetHelper.onClickAttributeGroupControl.bind(this));
    html.find(".attributes").on("click", "a.attribute-roll", EntitySheetHelper.onAttributeRoll.bind(this));
    
    // Item Controls
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));
    
    
    
    
    // Add draggable for Macro creation
    html.find(".attributes a.attribute-roll").each((i, a) => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        let dragData = ev.currentTarget.dataset;
        ev.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      }, false);
    });
    
    // Dealing with Input width
    let el = html.find(".input-wrap .input");
    let widthMachine = html.find(".input-wrap .width-machine");
    el.on("keyup", () => {
      widthMachine.html(el.val());
    });
    
    // Dealing with Textarea Height
    function calcHeight(value) {
      let numberOfLineBreaks = (value.match(/\n/g) || []).length;
      // min-height + lines x line-height + padding + border
      let newHeight = 20 + numberOfLineBreaks * 20 + 12 + 2;
      return newHeight;
    }
    
    let textarea = html.find(".resize-ta");
    textarea.on("keyup", () => {
      textarea.css("height", calcHeight(textarea.val()) + "px");
    });
    
  }
  
  /* -------------------------------------------- */
  
  /**
  * Handle click events for Item control buttons within the Actor Sheet
  * @param event
  * @private
  */
  _onItemControl(event) {
    event.preventDefault();
    
    // Obtain event data
    const button = event.currentTarget;
    const li = button.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    const action = button.dataset.action;

    // If the clicked element is an IMG with data-action="edit" (the item's image)
    if (item && action === "edit" && button.tagName === 'IMG' && button.classList.contains('item-control')) {
      const chatMessage = `@UUID[${item.uuid}]{${item.name}}`;
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: chatMessage
      });
      return; // Done, don't proceed to open edit sheet
    }
    
    // Handle different actions
    switch ( button.dataset.action ) {
      case "create":
      const cls = getDocumentClass("Item");
      // NPCActorSheet specific item creation logic, ensure type is handled if necessary or use a default
      // For simplicity, using "item" as default type as in original code.
      // If NPC sheet items can have different types like 'feature', 'worn', 'inventory' via specific create buttons,
      // this might need adjustment similar to SimpleActorSheet (reading button.dataset.type).
      // Based on the provided code, NPCActorSheet only has a generic "create" with type "item".
      return cls.create({name: game.i18n.localize("SIMPLE.ItemNew"), type: "item"}, {parent: this.actor});
      case "edit": // This will now only be reached if the image wasn't clicked (e.g., edit icon was clicked)
        if (item) return item.sheet.render(true);
        break;
      case "delete":
        if (item) return item.delete();
        break;
    }
  }
  
  /* -------------------------------------------- */
  
  /**
  * Listen for roll buttons on items.
  * @param {MouseEvent} event    The originating left click event
  */
  async _onItemRoll(event) {
    let button = $(event.currentTarget);
    const li = button.parents(".item");
    const item = this.actor.items.get(li.data("itemId"));
    let r = new Roll(button.data('roll'), this.actor.getRollData());
    return await r.toMessage({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h2>${item.name}</h2><h3>${button.text()}</h3>`
    });
  }
  
  /* -------------------------------------------- */
  
  /** @inheritdoc */
  _getSubmitData(updateData) {
    let formData = super._getSubmitData(updateData);
    formData = EntitySheetHelper.updateAttributes(formData, this.object);
    formData = EntitySheetHelper.updateGroups(formData, this.object);
    return formData;
  }
  
  /* -------------------------------------------- */
  
}