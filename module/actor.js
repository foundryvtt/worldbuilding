/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SimpleActor extends Actor {

  /** @override */
  getRollData() {
    const data = super.getRollData();
    const shorthand = game.settings.get("worldbuilding", "macroShorthand");
    const formulaAttributes = [];

    // Handle formula attributes when the short syntax is disabled.
    this._applyShorthand(data, formulaAttributes, shorthand);

    // Map all items data using their slugified names
    this._applyItems(data, shorthand);

    // Evaluate formula attributes after all other attributes have been handled,
    // including items.
    this._applyFormulaReplacements(data, formulaAttributes, shorthand);

    // Remove the attributes if necessary.
    if ( !!shorthand ) {
      delete data.attributes;
      delete data.attr;
      delete data.abil;
      delete data.groups;
    }

    return data;
  }

  /**
   * Apply shorthand syntax to actor roll data.
   * @param {Object} data The actor's data object.
   * @param {Array} formulaAttributes Array of attributes that are derived formulas.
   * @param {Boolean} shorthand Whether or not the shorthand syntax is used.
   */
  _applyShorthand(data, formulaAttributes, shorthand) {
    // Handle formula attributes when the short syntax is disabled.
    for ( let [k, v] of Object.entries(data.attributes) ) {
      // Make an array of formula attributes for later reference.
      if ( v.dtype == "Formula" ) formulaAttributes.push(k);
      // Add shortened version of the attributes.
      if ( !!shorthand ) {
        if ( !(k in data) ) {
          // Non-grouped attributes.
          if ( v.dtype ) {
            data[k] = v.value;
          }
          // Grouped attributes.
          else {
            data[k] = {};
            for ( let [attrKey, attrValue] of Object.entries(v) ) {
              data[k][attrKey] = attrValue.value;
              if ( attrValue.dtype == "Formula" ) formulaAttributes.push(`${k}.${attrKey}`);
            }
          }
        }
      }
    }
  }

  /**
   * Add items to the actor roll data object. Handles regular and shorthand
   * syntax, and calculates derived formula attributes on the items.
   * @param {Object} data The actor's data object.
   * @param {Boolean} shorthand Whether or not the shorthand syntax is used.
   */
  _applyItems(data, shorthand) {
    // Map all items data using their slugified names
    data.items = this.data.items.reduce((obj, i) => {
      let key = i.name.slugify({strict: true});
      let itemData = duplicate(i.data);
      const itemAttributes = [];

      // Add items to shorthand and note which ones are formula attributes.
      for ( let [k, v] of Object.entries(itemData.attributes) ) {
        if ( v.dtype == "Formula" ) itemAttributes.push(k);
        // Add shortened version of the attributes.
        if ( !!shorthand ) {
          if ( !(k in itemData) ) {
            itemData[k] = v.value;
          }
        }
      }

      // Evaluate formula attributes after all other attributes have been handled.
      for ( let k of itemAttributes ) {
        if ( itemData.attributes[k].value ) {
          itemData.attributes[k].value = this._replaceData(itemData.attributes[k].value, itemData);
          itemData.attributes[k].value = this._replaceData(itemData.attributes[k].value, data, {missing: "0"});
          // TODO: Replace with:
          // itemData.attributes[k].value = Roll.replaceFormulaData(itemData.attributes[k].value, itemData);
          // itemData.attributes[k].value = Roll.replaceFormulaData(itemData.attributes[k].value, data, {missing: "0"});
        }

        // Duplicate values to shorthand.
        if ( !!shorthand ) {
          itemData[k] = itemData.attributes[k].value;
        }
      }

      // Delete the original attributes key if using the shorthand syntax.
      if ( !!shorthand ) {
        delete itemData.attributes;
      }

      obj[key] = itemData;
      return obj;
    }, {});
  }

  /**
   * Apply replacements for derived formula attributes.
   * @param {Object} data The actor's data object.
   * @param {Array} formulaAttributes Array of attributes that are derived formulas.
   * @param {Boolean} shorthand Whether or not the shorthand syntax is used.
   */
  _applyFormulaReplacements(data, formulaAttributes, shorthand) {
    // Evaluate formula attributes after all other attributes have been handled,
    // including items.
    for ( let k of formulaAttributes ) {
      // Grouped attributes are included as `group.attr`, so we need to split
      // them into new keys.
      let attr = null;
      if ( k.includes('.') ) {
        let attrKey = k.split('.');
        k = attrKey[0];
        attr = attrKey[1];
      }
      // Non-grouped attributes.
      if ( data.attributes[k].value ) {
        data.attributes[k].value = this._replaceData(data.attributes[k].value, data, {missing: "0"});
        // TODO: Replace with:
        // data.attributes[k].value = Roll.replaceFormulaData(data.attributes[k].value, data, {missing: "0"});
      }
      // Grouped attributes.
      else {
        if ( attr ) {
          data.attributes[k][attr].value = this._replaceData(data.attributes[k][attr].value, data, {missing: "0"});
        }
      }

      // Duplicate values to shorthand.
      if ( !!shorthand ) {
        // Non-grouped attributes.
        if ( data.attributes[k].value ) {
          data[k] = data.attributes[k].value;
        }
        // Grouped attributes.
        else {
          if ( attr ) {
            // Initialize a group key in case it doesn't exist.
            if ( !data[k] ) {
              data[k] = {};
            }
            data[k][attr] = data.attributes[k][attr].value;
          }
        }
      }
    }
  }

  /**
   * Replace referenced data attributes in the roll formula with the syntax `@attr` with the corresponding key from
   * the provided `data` object. This is a temporary helper function that will be replaced with Roll.replaceFormulaData()
   * in Foundry 0.7.1.
   *
   * @param {String} formula    The original formula within which to replace.
   * @param {Object} data       Data object to use for value replacements.
   * @param {Object} missing    Value to use as missing replacements, such as {missing: "0"}.
   * @return {String} The formula with attributes replaced with values.
   */
  _replaceData(formula, data, {missing=null}={}) {
    // Exit early if the formula is invalid.
    if ( typeof formula != "string" ) {
      return 0;
    }

    // Replace attributes with their numeric equivalents.
    let dataRgx = new RegExp(/@([a-z.0-9_\-]+)/gi);
    let rollFormula = formula.replace(dataRgx, (match, term) => {
      // Replace matches with the value, or the missing value.
      let value = getProperty(data, term);
      return value ? String(value).trim() : (missing != null ? missing : `@${term}`);
    });

    return rollFormula;
  }
}
