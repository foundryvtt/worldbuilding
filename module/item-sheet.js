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
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}]
		});
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    data.dtypes = ["String", "Number", "Boolean"];
    for ( let attr of Object.values(data.data.attributes) ) {
      attr.isCheckbox = attr.dtype === "Boolean";
    }
    return data;
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

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add or Remove Attribute
    html.find(".attributes").on("click", ".attribute-control", this._onClickAttributeControl.bind(this));

    // Fix issues with focus tabbing on attribute forms.
    this._handleFocus(html);
  }

  /* -------------------------------------------- */

  /**
   * Listen for click events on an attribute control to modify the composition of attributes in the sheet
   * @param {MouseEvent} event    The originating left click event
   * @private
   */
  async _onClickAttributeControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    const attrs = this.object.data.data.attributes;
    const form = this.form;

    // Add new attribute
    if ( action === "create" ) {
      const nk = Object.keys(attrs).length + 1;
      let newKey = document.createElement("div");
      newKey.innerHTML = `<input type="text" name="data.attributes.attr${nk}.key" value="attr${nk}"/>`;
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

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {

    // Handle the free-form attributes list
    const formAttrs = expandObject(formData).data.attributes || {};
    const attributes = Object.values(formAttrs).reduce((obj, v) => {
      let k = v["key"].trim();
      if ( /[\s\.]/.test(k) )  return ui.notifications.error("Attribute keys may not contain spaces or periods");
      delete v["key"];
      obj[k] = v;
      return obj;
    }, {});
    
    // Remove attributes which are no longer used
    for ( let k of Object.keys(this.object.data.data.attributes) ) {
      if ( !attributes.hasOwnProperty(k) ) attributes[`-=${k}`] = null;
    }

    // Re-combine formData
    formData = Object.entries(formData).filter(e => !e[0].startsWith("data.attributes")).reduce((obj, e) => {
      obj[e[0]] = e[1];
      return obj;
    }, {_id: this.object._id, "data.attributes": attributes});

    // Update the Item
    return this.object.update(formData);
  }

  /* -------------------------------------------- */

  /**
   * Helper method to adjust tabbing behavior the attributes form. This disables
   * the default change behavior and instead only triggers an update if a tab is
   * changed or the window closes. In addition, creates a new entry when
   * tabbing into the last item.
   * @param {jQuery} html
   */
  _handleFocus(html) {
    // Disable the default input behavior so that only inputs in the header
    // area trigger form updates and re-renders. This allows us to only trigger
    // re-renders on the attribute tab if the tab is changed or the form is
    // closed.
    html.off("change", "input,select,textarea");
    html.on("change", ".sheet-header input, .sheet-header select, .sheet-header textarea", this._onChangeInput.bind(this));

    // When the user changes tabs, update the actor data.
    html.find('.tabs a.item').on('click', event => {
      this._onSubmit(event);
    });

    // If the user tabs into the last column, automatically create a new
    // attribute row for them.
    $(window).keyup(async e => {
      var code = (e.keyCode ? e.keyCode : e.which);
      if (code == 9 && html.find('.attribute:last-child select:focus').length) {
        const attrs = this.object.data.data.attributes;
        const form = this.form;

        // Add new attribute
        const nk = Object.keys(attrs).length + 1;
        let newKey = document.createElement("div");
        newKey.innerHTML = `<input type="text" name="data.attributes.attr${nk}.key" value="attr${nk}"/>`;
        newKey = newKey.children[0];
        form.appendChild(newKey);
        await this._onSubmit(event);

        // Reapply focus to the last element due to the re-render.
        setTimeout(() => {
          let newHtml = $(document).find(`.app[data-appid="${this.appId}"]`);
          newHtml.find('.attribute:nth-last-child(2) select').focus();
        }, 150);
      }
    });
  }
}
