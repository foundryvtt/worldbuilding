export class SWBTokenDocument extends TokenDocument {

  /**
   * A helper method to retrieve the underlying data behind one of the Token's attribute bars
   * @param {string} barName        The named bar to retrieve the attribute for
   * @param {string} alternative    An alternative attribute path to get instead of the default one
   * @return {object|null}          The attribute displayed on the Token bar, if any
   */
   getBarAttribute(barName, {alternative}={}) {
    const attr = alternative || (barName ? this.data[barName].attribute : null);
    if ( !attr || !this.actor ) return null;
    let data = foundry.utils.getProperty(this.actor.data.data, attr);
    if ( (data === null) || (data === undefined) ) return null;

    // Single values
    if ( Number.isNumeric(data) ) {
      return {
        type: "value",
        attribute: attr,
        value: Number(data),
        editable: true // super requires attribute to already exist in actor template
      }
    }

    // Attribute objects
    else if ( ("value" in data) && ("max" in data) ) {
      return {
        type: "bar",
        attribute: attr,
        value: Number(data.value || 0),
        max: Number(data.max || 0),
        editable: true // super requires attribute to already exist in actor template
      }
    }

    // Otherwise null
    return null;
  }
}