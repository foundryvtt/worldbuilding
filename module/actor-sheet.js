import { ATTRIBUTE_TYPES } from "./constants.js";

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
    data.dtypes = ATTRIBUTE_TYPES;
    for ( let attr of Object.values(data.data.attributes) ) {
      if ( attr.dtype ) {
        attr.isCheckbox = attr.dtype === "Boolean";
        attr.isResource = attr.dtype === "Resource";
      }
    }

    // Initialize ungrouped attributes for later.
    data.data.ungroupedAttributes = {};

    // Build an array of sorted group keys.
    const groups = data.data.groups || {};
    let groupKeys = Object.keys(groups).sort((a, b) => {
      let aSort = groups[a].label ?? a;
      let bSort = groups[b].label ?? b;
      return aSort.localeCompare(bSort);
    });

    // Iterate over the sorted groups to add their attributes.
    for ( let key of groupKeys ) {
      let group = data.data.attributes[key] || {};

      // Initialize the attributes container for this group.
      if ( !data.data.groups[key]['attributes'] ) data.data.groups[key]['attributes'] = {};

      // Sort the attributes within the group, and then iterate over them.
      Object.keys(group).sort((a, b) => a.localeCompare(b)).forEach(attr => {
        // For each attribute, determine whether it's a checkbox or resource, and then add it to the group's attributes list.
        group[attr]['isCheckbox'] = group[attr]['dtype'] === 'Boolean';
        group[attr]['isResource'] = group[attr]['dtype'] === 'Resource';
        data.data.groups[key]['attributes'][attr] = group[attr];
      });
    }

    // Sort the remaining attributes attributes.
    Object.keys(data.data.attributes).filter(a => !groupKeys.includes(a)).sort((a, b) => a.localeCompare(b)).forEach(key => {
      data.data.ungroupedAttributes[key] = data.data.attributes[key];
    });

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
    html.find(".attributes").on("click", "a.attribute-roll", this._onAttributeRoll.bind(this));

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

    // Add or Remove Attribute
    html.find(".attributes").on("click", ".attribute-control", this._onClickAttributeControl.bind(this));

    // Add attribute groups.
    html.find(".groups").on("click", ".group-control", this._onClickAttributeGroupControl.bind(this));

    // Add draggable for macros.
    html.find(".attributes a.attribute-roll").each((i, a) => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        let dragData = ev.currentTarget.dataset;
        ev.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      }, false);
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async _onSubmit(event, {updateData=null, preventClose=false, preventRender=false}={}) {
    // Exit early if this isn't a named attribute.
    if ( event.currentTarget ) {
      if ( event.currentTarget.tagName.toLowerCase() == 'input' && !event.currentTarget.hasAttribute('name')) {
        return;
      }
    }

    let self = $(event.currentTarget);
    let attr = null;

    // If this is the attribute key, we need to make a note of it so that we can restore focus when its recreated.
    if ( self.hasClass('attribute-key') ) {
      let val = self.val();
      let oldVal = self.parents('.attribute').data('attribute');
      oldVal = oldVal.includes('.') ? oldVal.split('.')[1] : oldVal;
      attr = self.attr('name').replace(oldVal, val);
    }

    // Submit the form.
    await super._onSubmit(event, {updateData: updateData, preventClose: preventClose, preventRender: preventRender});

    // If this was the attribute key, set a very short timeout and retrigger focus after the original element is deleted and the new one is inserted.
    if ( attr ) {
      setTimeout(() => {
        $(`input[name="${attr}"]`).parents('.attribute').find('.attribute-value').focus();
      }, 10);
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

  /**
   * Listen for the roll button on attributes.
   * @param {MouseEvent} event    The originating left click event
   */
  _onAttributeRoll(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const formula = button.closest(".attribute").querySelector(".attribute-value")?.value;
    const label = button.closest(".attribute").querySelector(".attribute-label")?.value;
    const chatLabel = label ?? button.parentElement.querySelector(".attribute-key").value;

    // If there's a formula, attempt to roll it.
    if ( formula ) {
      let r = new Roll(formula, this.actor.getRollData());
      r.roll().toMessage({
        user: game.user._id,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `${chatLabel}`
      });
    }
  }

  /**
   * Listen for click events on an attribute control to modify the composition of attributes in the sheet
   * @param {MouseEvent} event    The originating left click event
   * @private
   */
  async _onClickAttributeControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    const group = a.dataset.group;
    let dtype = a.dataset.dtype;
    const attrs = this.object.data.data.attributes;
    const groups = this.object.data.data.groups;
    const form = this.form;

    // Add new attribute
    if ( action === "create" ) {
      // Determine the new attribute key for ungrouped attributes.
      let objKeys = Object.keys(attrs).filter(k => !Object.keys(groups).includes(k));
      let nk = Object.keys(attrs).length + 1;
      let newValue = `attr${nk}`;
      let newKey = document.createElement("div");
      while ( objKeys.includes(newValue) ) {
        ++nk;
        newValue = `attr${nk}`;
      };

      // Build options for construction HTML inputs.
      let htmlItems = {
        key: {
          type: "text",
          value: newValue
        }
      };

      // Grouped attributes.
      if ( group ) {
        objKeys = attrs[group] ? Object.keys(attrs[group]) : [];
        nk = objKeys.length + 1;
        newValue = `attr${nk}`;
        while ( objKeys.includes(newValue) ) {
          ++nk;
          newValue =  `attr${nk}`;
        }

        // Update the HTML options used to build the new input.
        htmlItems.key.value = newValue;
        htmlItems.group = {
          type: "hidden",
          value: group
        };
        htmlItems.dtype = {
          type: "hidden",
          value: dtype
        };
      }
      // Ungrouped attributes.
      else {
        // Choose a default dtype based on the last attribute, fall back to "String".
        if (!dtype) {
          let lastAttr = document.querySelector('.attributes > .attributes-group .attribute:last-child .attribute-dtype')?.value;
          dtype = lastAttr ? lastAttr : "String";
          htmlItems.dtype = {
            type: "hidden",
            value: dtype
          };
        }
      }

      // Build the form elements used to create the new grouped attribute.
      newKey.innerHTML = this._getAttributeHtml(htmlItems, nk, group);

      // Append the form element and submit the form.
      newKey = newKey.children[0];
      form.appendChild(newKey);
      await this._onSubmit(event);
    }

    // Remove existing attribute
    else if ( action === "delete" ) {
      const li = a.closest(".attribute");
      li.parentElement.removeChild(li);
      await this._onSubmit(event);
    }
  }

  /**
   * Listen for click events and modify attribute groups.
   * @param {MouseEvent} event    The originating left click event
   */
  async _onClickAttributeGroupControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    const form = this.form;

    // Add new attribute group.
    if ( action === "create-group" ) {
      let newValue = $(a).siblings('.group-prefix').val();
      // Verify the new group key is valid, and use it to create the group.
      if ( newValue.length > 0 && this._validateGroup(newValue) ) {
        let newKey = document.createElement("div");
        newKey.innerHTML = `<input type="text" name="data.groups.${newValue}.key" value="${newValue}"/>`;
        // Append the form element and submit the form.
        newKey = newKey.children[0];
        form.appendChild(newKey);
        await this._onSubmit(event);
      }

    }

    // Remove existing attribute
    else if ( action === "delete-group" ) {
      let groupHeader = a.closest(".group-header");
      let group = $(groupHeader).find('.group-key');
      // Create a dialog to confirm group deletion.
      new Dialog({
        title: game.i18n.localize("SIMPLE.DeleteGroup"),
        content: `${game.i18n.localize("SIMPLE.DeleteGroupContent")} <strong>${group.val()}</strong>`,
        buttons: {
          confirm: {
            icon: '<i class="fas fa-trash"></i>',
            label: game.i18n.localize("Yes"),
            callback: async () => {
              groupHeader.parentElement.removeChild(groupHeader);
              await this._onSubmit(event);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("No"),
          }
        }
      }).render(true);
    }
  }

  /* -------------------------------------------- */


  /**
   * Return HTML for a new attribute to be applied to the form for submission.
   *
   * @param {Object} items  Keyed object where each item has a "type" and "value" property.
   * @param {string} index  Numeric index or key of the new attribute.
   * @param {string|boolean} group String key of the group, or false.
   *
   * @returns {string} Html string.
   */
  _getAttributeHtml(items, index, group = false) {
    // Initialize the HTML.
    let result = '<div>';
    // Iterate over the supplied keys and build their inputs (including whether or not they need a group key).
    for (let [key, item] of Object.entries(items)) {
      result = result + `<input type="${item.type}" name="data.attributes${group ? '.' + group : '' }.attr${index}.${key}" value="${item.value}"/>`;
    }
    // Close the HTML and return.
    return result + '</div>';
  }

  /* -------------------------------------------- */

  /**
   * Validate whether or not a group name can be used.
   * @param {string} groupName Groupname to validate
   * @returns {boolean}
   */
  _validateGroup(groupName) {
    let groups = Object.keys(this.actor.data.data.groups);

    // Check for duplicate group keys.
    if ( groups.includes(groupName) ) {
      ui.notifications.error(game.i18n.localize("SIMPLE.NotifyGroupDuplicate") + ` (${groupName})`);
      return false;
    }

    // Check for whitespace or periods.
    if ( groupName.match(/[\s|\.]/i) ) {
      ui.notifications.error(game.i18n.localize("SIMPLE.NotifyGroupAlphanumeric"));
      return false;
    }

    return true;
  }

  /** @override */
  _updateObject(event, formData) {

    // Handle attribute and group updates.
    formData = this._updateAttributes(formData);
    formData = this._updateGroups(formData);

    // Update the Actor with the new form values.
    return this.object.update(formData);
  }

  /**
   * Update attributes when updating an actor object.
   *
   * @param {Object} formData Form data object to modify keys and values for.
   * @returns {Object} updated formData object.
   */
  _updateAttributes(formData) {
    let groupKeys = [];

    // Handle the free-form attributes list
    const formAttrs = expandObject(formData).data.attributes || {};
    const attributes = Object.values(formAttrs).reduce((obj, v) => {
      let attrs = [];
      let group = null;
      // Handle attribute keys for grouped attributes.
      if ( !v["key"] ) {
        attrs = Object.keys(v);
        attrs.forEach(attrKey => {
          group = v[attrKey]['group'];
          groupKeys.push(group);
          let attr = v[attrKey];
          let k = v[attrKey]["key"] ? v[attrKey]["key"].trim() : attrKey.trim();
          if ( /[\s\.]/.test(k) )  return ui.notifications.error("Attribute keys may not contain spaces or periods");
          delete attr["key"];
          // Add the new attribute if it's grouped, but we need to build the nested structure first.
          if ( !obj[group] ) {
            obj[group] = {};
          }
          obj[group][k] = attr;
        });
      }
      // Handle attribute keys for ungrouped attributes.
      else {
        let k = v["key"].trim();
        if ( /[\s\.]/.test(k) )  return ui.notifications.error("Attribute keys may not contain spaces or periods");
        delete v["key"];
        // Add the new attribute only if it's ungrouped.
        if ( !group ) {
          obj[k] = v;
        }
      }
      return obj;
    }, {});

    // Remove attributes which are no longer used
    for ( let k of Object.keys(this.object.data.data.attributes) ) {
      if ( !attributes.hasOwnProperty(k) ) attributes[`-=${k}`] = null;
    }

    // Remove grouped attributes which are no longer used.
    for ( let group of groupKeys) {
      if ( this.object.data.data.attributes[group] ) {
        for ( let k of Object.keys(this.object.data.data.attributes[group]) ) {
          if ( !attributes[group].hasOwnProperty(k) ) attributes[group][`-=${k}`] = null;
        }
      }
    }

    // Re-combine formData
    formData = Object.entries(formData).filter(e => !e[0].startsWith("data.attributes")).reduce((obj, e) => {
      obj[e[0]] = e[1];
      return obj;
    }, {_id: this.object._id, "data.attributes": attributes});

    return formData;
  }

  /**
   * Update attribute groups when updating an actor object.
   *
   * @param {Object} formData Form data object to modify keys and values for.
   * @returns {Object} updated formData object.
   */
  _updateGroups(formData) {
    // Handle the free-form groups list
    const formGroups = expandObject(formData).data.groups || {};
    const groups = Object.values(formGroups).reduce((obj, v) => {
      // If there are duplicate groups, collapse them.
      if ( Array.isArray(v["key"]) ) {
        v["key"] = v["key"][0];
      }
      // Trim and clean up.
      let k = v["key"].trim();
      if ( /[\s\.]/.test(k) )  return ui.notifications.error("Group keys may not contain spaces or periods");
      delete v["key"];
      obj[k] = v;
      return obj;
    }, {});

    // Remove groups which are no longer used
    for ( let k of Object.keys(this.object.data.data.groups) ) {
      if ( !groups.hasOwnProperty(k) ) groups[`-=${k}`] = null;
    }

    // Re-combine formData
    formData = Object.entries(formData).filter(e => !e[0].startsWith("data.groups")).reduce((obj, e) => {
      obj[e[0]] = e[1];
      return obj;
    }, {_id: this.object._id, "data.groups": groups});

    return formData;
  }
}
