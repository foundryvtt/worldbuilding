import { EntitySheetHelper } from "./helper.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class SimpleActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["worldbuilding", "sheet", "actor"],
      template: "systems/worldbuilding/templates/actor-sheet.html",
      width: 600,
      height: 600,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".biography", ".items", ".attributes"],
      dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();

    // Handle attribute groups.
    EntitySheetHelper.getAttributeData(data);

    // Add shorthand.
    data.shorthand = !!game.settings.get("worldbuilding", "macroShorthand");
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Handle rollable items.
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));

    // Handle rollable attributes.
    html.find(".attributes").on("click", "a.attribute-roll", EntitySheetHelper.onAttributeRoll.bind(this));

    // Everything below here is only needed if the sheet is editable
    if ( !this.options.editable ) return;

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.getOwnedItem(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteOwnedItem(li.data("itemId"));
      li.slideUp(200, () => this.render(false));
    });

    // Add draggable for macros.
    html.find(".attributes a.attribute-roll").each((i, a) => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        let dragData = ev.currentTarget.dataset;
        ev.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      }, false);
    });

    // Add or Remove Attribute
    html.find(".attributes").on("click", ".attribute-control", EntitySheetHelper.onClickAttributeControl.bind(this));

    // Add attribute groups.
    html.find(".groups").on("click", ".group-control", EntitySheetHelper.onClickAttributeGroupControl.bind(this));
  }

  /* -------------------------------------------- */

  /** @override */
  async _onSubmit(event, {updateData=null, preventClose=false, preventRender=false}={}) {
    let attr = EntitySheetHelper.onSubmit(event);

    // Submit the form if attr is true or an attr key.
    if ( attr ) {
      await super._onSubmit(event, {updateData: updateData, preventClose: preventClose, preventRender: preventRender});

      // If attr is a key and not just true, set a very short timeout and retrigger focus after the original element is deleted and the new one is inserted.
      if ( attr !== true) {
        setTimeout(() => {
          $(`input[name="${attr}"]`).parents('.attribute').find('.attribute-value').focus();
        }, 10);
      }
    }
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options={}) {
    const position = super.setPosition(options);
    const sheetBody = this.element.find(".sheet-body");
    const bodyHeight = position.height - 192;
    sheetBody.css("height", bodyHeight);
    return position;
  }

  /* -------------------------------------------- */

  /**
   * Listen for roll buttons on items.
   * @param {MouseEvent} event    The originating left click event
   */
  _onItemRoll(event) {
    let button = $(event.currentTarget);
    let r = new Roll(button.data('roll'), this.actor.getRollData());
    const li = button.parents(".item");
    const item = this.actor.getOwnedItem(li.data("itemId"));
    r.roll().toMessage({
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h2>${item.name}</h2><h3>${button.text()}</h3>`
    });
  }

  /** @override */
  _updateObject(event, formData) {

    // Handle attribute and group updates.
    formData = EntitySheetHelper.updateAttributes(formData, this);
    formData = EntitySheetHelper.updateGroups(formData, this);

    // Update the Actor with the new form values.
    return this.object.update(formData);
  }

}
