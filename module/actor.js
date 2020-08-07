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

    // Re-map all attributes onto the base roll data
    if ( !!shorthand ) {
      for ( let [k, v] of Object.entries(data.attributes) ) {
        if ( !(k in data) ) {
          data[k] = v.value;
          // Make an array of formula attributes for later reference.
          if ( v.dtype == "Formula" ) formulaAttributes.push(k);
        }
      }
      delete data.attributes;
    }
    // Handle formula attributes when the short syntax is disabled.
    else {
      for ( let [k, v] of Object.entries(data.attributes) ) {
        // Make an array of formula attributes for later reference.
        if ( v.dtype == "Formula" ) formulaAttributes.push(k);
      }
    }

    // Map all items data using their slugified names
    data.items = this.data.items.reduce((obj, i) => {
      let key = i.name.slugify({strict: true});
      let itemData = duplicate(i.data);
      const itemAttributes = [];

      // Add items as shorthand.
      if ( !!shorthand ) {
        for ( let [k, v] of Object.entries(itemData.attributes) ) {
          if ( !(k in itemData) ) {
            itemData[k] = v.value;
            if ( v.dtype == "Formula" ) itemAttributes.push(k);
          }
        }
        delete itemData["attributes"];
      }
      // Add formula items when shorthand isn't enabled.
      else {
        for ( let [k, v] of Object.entries(itemData.attributes) ) {
          if ( v.dtype == "Formula" ) itemAttributes.push(k);
        }
      }

      // Evaluate formula attributes after all other attributes have been handled.
      for ( let k of itemAttributes ) {
        // Shorthand.
        if ( !!shorthand ) {
          if ( itemData[k] ) {
            itemData[k] = this._replaceData(itemData[k], itemData, data);
          }
        }
        // Full syntax.
        else {
          if ( itemData.attributes[k].value ) {
            itemData.attributes[k].value = this._replaceData(itemData.attributes[k].value, itemData, data);
          }
        }
      }

      obj[key] = itemData;
      return obj;
    }, {});

    // Evaluate formula attributes after all other attributes have been handled,
    // including items.
    for ( let k of formulaAttributes ) {
      // Shorthand.
      if ( !!shorthand ) {
        if ( data[k] ) {
          data[k] = this._replaceData(data[k], data);
        }
      }
      // Full syntax.
      else {
        if ( data.attributes[k].value ) {
          data.attributes[k].value = this._replaceData(data.attributes[k].value, data);
        }
      }
    }

    return data;
  }

  /**
   * Replace referenced data attributes in the roll formula with the syntax `@attr` with the corresponding key from
   * the provided `data` object.
   * @param {String} formula    The original formula within which to replace.
   * @return {String} The formula with attributes replaced with values.
   */
  _replaceData(formula, dataPrimary, dataSecondary = null) {
    // Exit early if the formula is invalid.
    if ( typeof formula != "string" ) {
      return 0;
    }

    // Replace attributes with their numeric equivalents.
    let dataRgx = new RegExp(/@([a-z.0-9_\-]+)/gi);
    let rollFormula = formula.replace(dataRgx, (match, term) => {
      // Try the primary data source first (ex: actor, item).
      let value = getProperty(dataPrimary, term);
      if ( value ) {
        return String(value).trim();
      }
      // Try the secondary data source next (ex: actor that owns item);
      else if (dataSecondary) {
        value = getProperty(dataSecondary, term);
        return value ? String(value).trim() : "0";
      }
      // Otherwise, return 0.
      return "0";
    });

    return rollFormula;
  }
}
