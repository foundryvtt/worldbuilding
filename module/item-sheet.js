import { EntitySheetHelper } from "./helper.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class SimpleItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["worldbuilding", "sheet", "item"],
      template: "systems/worldbuilding/templates/item-sheet.html",
      width: 520,
      height: 480,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".attributes"],
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();

    // Handle attribute groups.
    EntitySheetHelper.getAttributeData(data);

    return data;
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

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Handle rollable attributes.
    html.find(".attributes").on("click", "a.attribute-roll", EntitySheetHelper.onAttributeRoll.bind(this));

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

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
  _updateObject(event, formData) {

    // Handle attribute and group updates.
    formData = EntitySheetHelper.updateAttributes(formData, this);
    formData = EntitySheetHelper.updateGroups(formData, this);

    // Update the Actor with the new form values.
    return this.object.update(formData);
  }
}
