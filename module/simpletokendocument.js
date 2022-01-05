export class SimpleTokenDocument extends TokenDocument {

  /** @inheritdoc */
  getBarAttribute(barName, {alternative}={}) {
	const attr = super.getBarAttribute(barName, {alternative});
	if ( attr === null ) return null;
	attr.editable = true; // Attribute always editable, super requires attr to exist in actor template
	return attr;
  }
  
}