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

    // Enrich item descriptions
    for (let item of context.data.items) {
      item.system.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description, {
        secrets: this.document.isOwner,
        async: true
      });
    }
    
    context.actor = this.actor; // Add this line to include the actor object in the context
    
    const imageLink = context.data.img;
    context.imageStyle = `background: url(${imageLink});`;
    
    return context;
  }
  
  /* -------------------------------------------- */
  
  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Restore vault state on re-render
    if (this._vaultOpen) {
      const vaultList = html.find('.item-list[data-item-type="vault"]');
      const icon = html.find('.vault-toggle i');
      vaultList.show();
      icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    }
    
    // Everything below here is only needed if the sheet is editable
    if ( !this.isEditable ) return;
    
    // Resource Management
    html.find(".resource-control").click(this._onResourceControl.bind(this));

    // Attribute Management
    html.find(".attributes").on("click", ".attribute-control", EntitySheetHelper.onClickAttributeControl.bind(this));
    html.find(".groups").on("click", ".group-control", EntitySheetHelper.onClickAttributeGroupControl.bind(this));
    html.find(".attributes").on("click", "a.attribute-roll", EntitySheetHelper.onAttributeRoll.bind(this));
    
    //Clickable Labels Block
    html.find(".traits").on("click", ".trait label", this._onTraitLabelClick.bind(this));
    html.find(".click-rollable-group").on("click", ".click-rollable", this._onRollableClick.bind(this));
    html.find(".basic-rollable-group").on("click", ".basic-rollable", this._onBasicRollableClick.bind(this));
    
    // Item Controls
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".rollable").on("click", this._onItemRoll.bind(this));
    
    // Handle toggling item description visibility
    html.find(".item-name[data-action=\"toggle-description\"]").click(this._onToggleDescription.bind(this));
    
    //Cards System
    html.find('.remove-card').click(this._onRemoveCard.bind(this));
    
    // Vault Toggle
    html.find('.vault-toggle').click(this._onToggleVault.bind(this));
    
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
  async _onItemControl(event) {
    event.preventDefault();
    
    // Obtain event data
    const button = event.currentTarget;
    const li = button.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    const action = button.dataset.action;

    // If the clicked element is an IMG with data-action="edit" (the item's image)
    if (item && action === "edit" && button.tagName === 'IMG' && button.classList.contains('item-control')) {
      const itemData = item.system;
      const description = await TextEditor.enrichHTML(itemData.description, {secrets: this.actor.isOwner, async: true});
      const chatCard = `
      <div class="item-card-chat" data-item-id="${item.id}" data-actor-id="${this.actor.id}">
          <div class="card-image-container" style="background-image: url('${item.img}')">
              <div class="card-header-text">
                  <h3>${item.name}</h3>
              </div>
          </div>
          <div class="card-content">
              <div class="card-subtitle">
                  <span>${itemData.category || ''} - ${itemData.rarity || ''}</span>
              </div>
              <div class="card-description">
                  ${description}
              </div>
          </div>
      </div>
      `;

      ChatMessage.create({
          user: game.user.id,
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: chatCard
      });
      return; // Done, don't proceed to open edit sheet
    }
    
    const type = button.dataset.type; // Ensure type is read for create actions
    
    switch (action) {
      case "create":
      const clsi = getDocumentClass("Item");
      return clsi.create({name: "New Ability", type: type}, {parent: this.actor}); // Use the type variable here
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
      case "send-to-vault":
        if (item && item.type === "domain") {
          // Create a new vault item with the same data
          const itemData = {
            name: item.name,
            type: "vault",
            img: item.img,
            system: item.system
          };
          // Create the new vault item
          await getDocumentClass("Item").create(itemData, {parent: this.actor});
          // Delete the original domain item
          return item.delete();
        }
        break;
      case "send-to-domain":
        if (item && item.type === "vault") {
          // Create a new domain item with the same data
          const itemData = {
            name: item.name,
            type: "domain",
            img: item.img,
            system: item.system
          };
          // Create the new domain item
          await getDocumentClass("Item").create(itemData, {parent: this.actor});
          // Delete the original vault item
          return item.delete();
        }
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
    
    // If the item comes from the same actor, it's a move.
    if (this.actor.items.has(item.id)) {
        const existingItem = this.actor.items.get(item.id);
        // If it's the same type do nothing
        if (existingItem.type === newType) return;

        // Create a new item of the correct type with the old item's data.
        const newItemData = existingItem.toObject();
        newItemData.type = newType;
        
        // Delete the old item and create the new one
        await existingItem.delete();
        return this.actor.createEmbeddedDocuments("Item", [newItemData]);

    } else {
      // Otherwise, we are creating a new item from a drop
      const newItemData = item.toObject();
      newItemData.type = newType;
      return this.actor.createEmbeddedDocuments("Item", [newItemData]);
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
    // if the sheet is an actor, gets its proficiency value. If its an adversary, rollValueInput contains all the info
    const rollProfInput = html[0].querySelector("#prof")?.value || "";

    console.log("Current proficiency: ", rollProfInput);
    console.log("Current value: ", rollValueInput.value);
    
    const rollName = rollNameInput.value;
    const rollValue = rollProfInput + rollValueInput.value;
    
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
    const traitNamePrint = traitName.charAt(0).toUpperCase() + traitName.slice(1);

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

    const dialogContent = `
    <form>
    <div class="flex-col" style="align-items: stretch; gap: 2rem">
        <div class="flex-row" style="justify-content: center; gap: 2rem;">
            <div class="flex-col">
                <span class="label-bar">Hope Die</span>
                <select name="hopeDieSize" id="hopeDieSize">
                    <option value="d12" selected>d12</option>
                    <option value="d20">d20</option>
                </select>
            </div>
            <div class="flex-col">
                <span class="label-bar">Fear Die</span>
                <select name="fearDieSize" id="fearDieSize">
                    <option value="d12" selected>d12</option>
                    <option value="d20">d20</option>
                </select>
            </div>
        </div>
      <div class="flex-row">
        <div class="flex-col stepper-group">
          <span class="label-bar">Advantage</span>
          <div class="flex-row">
            <button id="adv-minus" class="clicker-button clicker-minus-button" type="button"></button>
            <input id="dualityDiceAdvantageInput" min="0" name="advantage" step="1" type="number" value="0"/>
            <button id="adv-plus" class="clicker-button clicker-plus-button" type="button"></button>
          </div>
        </div>
        <div class="flex-col stepper-group">
          <span class="label-bar">Disadvantage</span>
          <div class="flex-row">
            <button id="dis-minus" class="clicker-button clicker-minus-button" type="button"></button>
            <input id="dualityDiceDisadvantageInput" min="0" name="disadvantage" step="1" type="number" value="0"/>
            <button id="dis-plus" class="clicker-button clicker-plus-button" type="button"></button>
          </div>
        </div>
      </div>
      <div class="flex-row">
        <div class="flex-col stepper-group">
          <span class="label-bar">Flat Modifier</span>
          <div class="flex-row">
            <button id="mod-minus" class="clicker-button clicker-minus-button" type="button"></button>
            <input id="dualityDiceModifierInput" autofocus name="modifier" step="1" type="number" value="0"/>
            <button id="mod-plus" class="clicker-button clicker-plus-button" type="button"></button>
          </div>
        </div>
      </div>
    </div>
    </form>
    `;

    const dialogChoice = await new Promise(resolve => {
        new Dialog({
            title: `Roll for ${traitNamePrint}`,
            content: dialogContent,
            buttons: {
                roll: {
                    label: "Roll",
                    icon: "<i class='fas fa-dice-d12'></i>",
                    callback: (html) => {
                        const advantage = parseInt(html.find('#dualityDiceAdvantageInput').val()) || 0;
                        const disadvantage = parseInt(html.find('#dualityDiceDisadvantageInput').val()) || 0;
                        const modifier = parseInt(html.find('#dualityDiceModifierInput').val()) || 0;
                        const hopeDieSize = html.find('#hopeDieSize').val();
                        const fearDieSize = html.find('#fearDieSize').val();
                        resolve({ advantage, disadvantage, modifier, hopeDieSize, fearDieSize });
                    }
                },
                cancel: {
                    label: "Cancel",
                    callback: () => resolve(null)
                }
            },
            default: 'roll',
            render: (html) => {
                function incrementInput(selector, by, clampLo = null) {
                    let input = html.find(selector);
                    if (input.length === 0) return;
                    let newValue = (parseInt(input.val()) || 0) + by;
                    if (clampLo !== null) newValue = Math.max(clampLo, newValue);
                    input.val(newValue);
                }

                html.find('#adv-plus').click(() => incrementInput('#dualityDiceAdvantageInput', 1, 0));
                html.find('#adv-minus').click(() => incrementInput('#dualityDiceAdvantageInput', -1, 0));
                html.find('#dis-plus').click(() => incrementInput('#dualityDiceDisadvantageInput', 1, 0));
                html.find('#dis-minus').click(() => incrementInput('#dualityDiceDisadvantageInput', -1, 0));
                html.find('#mod-plus').click(() => incrementInput('#dualityDiceModifierInput', 1));
                html.find('#mod-minus').click(() => incrementInput('#dualityDiceModifierInput', -1));

                for (const input of html.find("input[type=number]")) {
                    input.addEventListener("wheel", (event) => {
                        if (input === document.activeElement) {
                            event.preventDefault();
                            event.stopPropagation();
                            const step = Math.sign(-1 * event.deltaY);
                            const oldValue = Number(input.value) || 0;
                            input.value = String(oldValue + step);
                        }
                    });
                }
            },
            close: () => resolve(null)
        }, {
            classes: ["daggerheart-roll-dialog"]
        }).render(true);
    });

    if (!dialogChoice) { return; }

    const { advantage, disadvantage, modifier, hopeDieSize, fearDieSize } = dialogChoice;
    const totalAdvantage = advantage - disadvantage;

    let rollType = "Normal";
    let coreFormula = `1${hopeDieSize} + 1${fearDieSize}`;
    let flavorSuffix = "";
    if (totalAdvantage > 0) {
        coreFormula += ` + ${totalAdvantage}d6kh1`;
        rollType = "Advantage";
        flavorSuffix = ` with ${totalAdvantage} Advantage`;
    } else if (totalAdvantage < 0) {
        const disAdv = Math.abs(totalAdvantage);
        coreFormula += ` - ${disAdv}d6kh1`;
        rollType = "Disadvantage";
        flavorSuffix = ` with ${disAdv} Disadvantage`;
    }

    const fullRollFormula = `${coreFormula} + ${traitValue + modifier}`;
    const roll = await new Roll(fullRollFormula).roll();

    let hopeDieValue, fearDieValue;
    let isCrit = false;

    if (roll.dice.length >= 2) {
      roll.dice[0].options.flavor = "Hope";
      hopeDieValue = roll.dice[0].total;

      roll.dice[1].options.flavor = "Fear";
      fearDieValue = roll.dice[1].total;

      isCrit = hopeDieValue === fearDieValue;

      if (roll.dice.length >= 3) {
        roll.dice[2].options.flavor = "Modifier";
      }
    } else {
      console.error(`Worldbuilding | Critical error during ${traitNamePrint} roll: Less than two primary dice terms found. Roll object:`, roll);
      return;
    }

    const isHope = hopeDieValue > fearDieValue;
    const isFear = hopeDieValue < fearDieValue;

    let finalFlavor = `${traitNamePrint}${flavorSuffix}`;
    if (modifier !== 0) {
        finalFlavor += modifier > 0 ? ` +${modifier}` : ` ${modifier}`;
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

  async _onToggleVault(event) {
    event.preventDefault();
    const button = $(event.currentTarget);
    const icon = button.find('i');
    const vaultList = this.element.find('.item-list[data-item-type="vault"]');

    if (vaultList.is(':visible')) {
        vaultList.slideUp();
        icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
        this._vaultOpen = false;
    } else {
        vaultList.slideDown();
        icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
        this._vaultOpen = true;
    }
  }

  async _onToggleDescription(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    const descriptionDiv = li.querySelector(".item-description");

    if (!descriptionDiv) return;
    
    if (li.classList.contains("expanded")) {
      descriptionDiv.style.height = descriptionDiv.scrollHeight + "px";
      descriptionDiv.offsetHeight;
      descriptionDiv.style.height = "0px";
      li.classList.remove("expanded");
    } else {
      li.classList.add("expanded");
      descriptionDiv.style.height = descriptionDiv.scrollHeight + "px";
      setTimeout(() => {
        if (li.classList.contains("expanded")) {
          descriptionDiv.style.height = "auto";
        }
      }, 150);
    }
  }

  async _onResourceControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    const field = a.dataset.field;

    const value = foundry.utils.getProperty(this.actor.system, field);
    let updateValue;

    if (action === 'increment') {
      updateValue = Number(value) + 1;
    } else if (action === 'decrement') {
      updateValue = Number(value) - 1;
    }

    if (updateValue !== undefined) {
      this.actor.update({
        [`system.${field}`]: updateValue
      });
    }
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

    // Enrich item descriptions
    for (let item of context.data.items) {
      item.system.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description, {
        secrets: this.document.isOwner,
        async: true
      });
    }
    
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
    
    let el = html.find(".input-wrap .input");
    let widthMachine = html.find(".input-wrap .width-machine");
    el.on("keyup", () => {
      widthMachine.html(el.val());
    });
    
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
  async _onItemControl(event) {
    event.preventDefault();
    
    // Obtain event data
    const button = event.currentTarget;
    const li = button.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    const action = button.dataset.action;

    // If the clicked element is an IMG with data-action="edit" (the item's image)
    if (item && action === "edit" && button.tagName === 'IMG' && button.classList.contains('item-control')) {
      const itemData = item.system;
      const description = await TextEditor.enrichHTML(itemData.description, {secrets: this.actor.isOwner, async: true});
      const chatCard = `
      <div class="item-card-chat" data-item-id="${item.id}" data-actor-id="${this.actor.id}">
          <div class="card-image-container" style="background-image: url('${item.img}')">
              <div class="card-header-text">
                  <h3>${item.name}</h3>
              </div>
          </div>
          <div class="card-content">
              <div class="card-subtitle">
                  <span>${itemData.category || ''} - ${itemData.rarity || ''}</span>
              </div>
              <div class="card-description">
                  ${description}
              </div>
          </div>
      </div>
      `;

      ChatMessage.create({
          user: game.user.id,
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: chatCard
      });
      return; // Done, don't proceed to open edit sheet
    }
    
    // Handle different actions
    switch ( button.dataset.action ) {
      case "create":
      const cls = getDocumentClass("Item");
      return cls.create({name: game.i18n.localize("SIMPLE.ItemNew"), type: "item"}, {parent: this.actor});
      case "edit": 
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
  
  async _rollTrait(traitName, traitValue) {
    const traitNamePrint = traitName.charAt(0).toUpperCase() + traitName.slice(1);
    const roll = new Roll(`1d20 + @mod`, {mod: traitValue});
    await roll.evaluate({async: true});
  
    const d20Term = roll.terms.find(t => t.faces === 20);
    const d20result = d20Term.results[0].result;
  
    let flavor = `${traitNamePrint}`;
    if (d20result === 20) {
      flavor += ` - Critical Success!`;
    }
  
    await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ token: this.actor }),
        flavor: flavor
    });
  }
  
  /** @inheritdoc */
  _getSubmitData(updateData) {
    let formData = super._getSubmitData(updateData);
    if (this.actor.type === "npc") {
      formData["system.isNPC"] = true;
    }
    return formData;
  }
}