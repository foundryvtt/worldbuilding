export class CoinCounterHUD extends FormApplication {
  constructor(options = {}) {
    super(null, options);
    this.coins = 0; // Set a default value for coins
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "coin-counter-hud",
      template: "systems/worldbuilding/templates/coin-counter-hud.html",
      popOut: false,
      minimizable: false,
      resizable: false,
      title: "Coin Counter",
    });
  }

  getData() {
    return {
      coins: this.coins || 0,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".coin-add").click(this._onAddCoin.bind(this));
    html.find(".coin-remove").click(this._onRemoveCoin.bind(this));
  }

  async _updateObject(event, formData) {
    this.coins = parseInt(formData.coins) || 0; // Parse the coins value as an integer
    this.render(); // Re-render the HUD to reflect the updated coins value
  }

  async _onAddCoin(event) {
    event.preventDefault();
    await this.submit({ coins: (this.coins || 0) + 1 });
  }

  async _onRemoveCoin(event) {
    event.preventDefault();
    await this.submit({ coins: Math.max(0, (this.coins || 0) - 1) });
  }
}