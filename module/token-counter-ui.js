/**
 * A persistent counter UI element that displays HP and Hope for the selected token
 */
export class TokenCounterUI {
  constructor() {
    this.element = null;
    this.selectedToken = null;
    this.hp = { current: 0, max: 0 };
    this.hope = { current: 0, max: 0 };
    this.stress = { current: 0, max: 0 };
    this.actorType = null;
  }

  /**
   * Initialize the token counter UI
   */
  async initialize() {
    // Render the counter (initially hidden)
    await this.render();
    
    // Listen for control token changes
    Hooks.on("controlToken", (token, controlled) => {
      if (controlled) {
        this.setSelectedToken(token);
      } else {
        // Check if any tokens are still controlled
        const controlledTokens = canvas.tokens?.controlled || [];
        if (controlledTokens.length === 0) {
          this.setSelectedToken(null);
        }
      }
    });

    // Listen for token updates
    Hooks.on("updateToken", (token, change, options, userId) => {
      if (token === this.selectedToken?.document) {
        this.updateFromToken(token.object);
      }
    });

    // Listen for actor updates
    Hooks.on("updateActor", (actor, change, options, userId) => {
      if (this.selectedToken && this.selectedToken.document.actorId === actor.id) {
        this.updateFromToken(this.selectedToken);
      }
    });

    // Listen for canvas ready to clear selection
    Hooks.on("canvasReady", () => {
      this.setSelectedToken(null);
    });
  }

  /**
   * Set the selected token and update the display
   */
  setSelectedToken(token) {
    this.selectedToken = token;
    if (token) {
      this.updateFromToken(token);
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Update values from the selected token
   */
  updateFromToken(token) {
    if (!token || !token.actor) return;
    
    const actor = token.actor;
    const system = actor.system;
    this.actorType = actor.type;
    
    // Initialize missing data for NPCs if needed
    if (this.actorType === 'npc') {
      // Ensure health exists
      if (!system.health) {
        system.health = { value: 0, max: 0 };
      }
      // Ensure stress exists
      if (!system.stress) {
        system.stress = { value: 0, max: 0 };
      }
    }
    
    // Get HP values
    if (system.health) {
      this.hp.current = parseInt(system.health.value) || 0;
      this.hp.max = parseInt(system.health.max) || 0;
    } else {
      // Default to 0 if not defined
      this.hp.current = 0;
      this.hp.max = 0;
    }
    
    // For characters, get Hope values
    if (this.actorType === 'character') {
      if (system.hope) {
        this.hope.current = parseInt(system.hope.value) || 0;
        this.hope.max = parseInt(system.hope.max) || 0;
      } else {
        this.hope.current = 0;
        this.hope.max = 0;
      }
      // Clear stress for characters
      this.stress.current = 0;
      this.stress.max = 0;
    }
    // For NPCs (Adversaries), get Stress values
    else if (this.actorType === 'npc') {
      if (system.stress) {
        this.stress.current = parseInt(system.stress.value) || 0;
        this.stress.max = parseInt(system.stress.max) || 0;
      } else {
        this.stress.current = 0;
        this.stress.max = 0;
      }
      // Clear hope for NPCs
      this.hope.current = 0;
      this.hope.max = 0;
    }
    
    this.updateDisplay();
  }

  /**
   * Render the token counter UI element
   */
  async render() {
    // Check if the user can modify the counter (GM or Assistant GM)
    const canModify = game.user.isGM || game.user.hasRole("ASSISTANT");
    
    // Create HP counter HTML (to go before Fear)
    const hpHtml = `
      <div id="token-hp-counter" class="faded-ui counter-ui token-counter" style="position: relative; z-index: 9998; display: none;">
        ${canModify ? `
        <button type="button" class="counter-minus hp-minus" title="Decrease HP" style="position: relative; z-index: 10000; pointer-events: all;">
          <i class="fas fa-minus"></i>
        </button>
        ` : ''}
        <div class="counter-display">
          <div class="counter-value hp-value">0/0</div>
          <div class="counter-label">HP</div>
        </div>
        ${canModify ? `
        <button type="button" class="counter-plus hp-plus" title="Increase HP" style="position: relative; z-index: 10000; pointer-events: all;">
          <i class="fas fa-plus"></i>
        </button>
        ` : ''}
      </div>
    `;
    
    // Create Hope/Stress counter HTML (to go after Fear)
    // Will display Hope for characters, Stress for NPCs/Adversaries
    const hopeStressHtml = `
      <div id="token-hope-counter" class="faded-ui counter-ui token-counter" style="position: relative; z-index: 9998; display: none;">
        ${canModify ? `
        <button type="button" class="counter-minus hope-stress-minus" title="Decrease" style="position: relative; z-index: 10000; pointer-events: all;">
          <i class="fas fa-minus"></i>
        </button>
        ` : ''}
        <div class="counter-display">
          <div class="counter-value hope-stress-value">0/0</div>
          <div class="counter-label hope-stress-label">Hope</div>
        </div>
        ${canModify ? `
        <button type="button" class="counter-plus hope-stress-plus" title="Increase" style="position: relative; z-index: 10000; pointer-events: all;">
          <i class="fas fa-plus"></i>
        </button>
        ` : ''}
      </div>
    `;
    
    // Find or create the counters wrapper
    let countersWrapper = document.getElementById("counters-wrapper");
    if (!countersWrapper) {
      // Create wrapper if it doesn't exist
      const wrapperHtml = '<div id="counters-wrapper" class="counters-wrapper"></div>';
      
      const hotbar = document.getElementById("hotbar");
      if (hotbar) {
        hotbar.insertAdjacentHTML("beforebegin", wrapperHtml);
      } else {
        const uiBottom = document.getElementById("ui-bottom");
        if (uiBottom) {
          uiBottom.insertAdjacentHTML("afterbegin", wrapperHtml);
        }
      }
      
      countersWrapper = document.getElementById("counters-wrapper");
    }
    
    // Find the Fear counter to position our counters around it
    const counterUI = document.getElementById("counter-ui");
    if (counterUI) {
      // Insert HP before Fear counter
      counterUI.insertAdjacentHTML("beforebegin", hpHtml);
      // Insert Hope/Stress after Fear counter
      counterUI.insertAdjacentHTML("afterend", hopeStressHtml);
    } else {
      // If no Fear counter exists, just add to the wrapper
      countersWrapper.insertAdjacentHTML("afterbegin", hpHtml);
      countersWrapper.insertAdjacentHTML("beforeend", hopeStressHtml);
    }
    
    // Store references to both elements
    this.hpElement = document.getElementById("token-hp-counter");
    this.hopeElement = document.getElementById("token-hope-counter");
    this.element = { hp: this.hpElement, hope: this.hopeElement };
    
    // Activate listeners with a small delay to ensure DOM is ready
    if (canModify) {
      setTimeout(() => {
        this.activateListeners();
      }, 100);
    }
  }

  /**
   * Activate event listeners
   */
  activateListeners() {
    // Add event listeners for HP and Hope buttons
    ["click", "mousedown", "pointerdown"].forEach(eventType => {
      document.body.addEventListener(eventType, async (e) => {
        // HP buttons
        if (e.target.closest("#token-hp-counter .hp-plus")) {
          e.preventDefault();
          e.stopPropagation();
          if (eventType === "click") {
            await this.modifyHP(1);
          }
        } else if (e.target.closest("#token-hp-counter .hp-minus")) {
          e.preventDefault();
          e.stopPropagation();
          if (eventType === "click") {
            await this.modifyHP(-1);
          }
        }
        // Hope/Stress buttons
        else if (e.target.closest("#token-hope-counter .hope-stress-plus")) {
          e.preventDefault();
          e.stopPropagation();
          if (eventType === "click") {
            await this.modifyHopeOrStress(1);
          }
        } else if (e.target.closest("#token-hope-counter .hope-stress-minus")) {
          e.preventDefault();
          e.stopPropagation();
          if (eventType === "click") {
            await this.modifyHopeOrStress(-1);
          }
        }
      }, true); // Use capture phase
    });
  }

  /**
   * Modify HP value
   */
  async modifyHP(delta) {
    if (!this.selectedToken || !this.selectedToken.actor) return;
    
    // Check permissions
    if (!game.user.isGM && !game.user.hasRole("ASSISTANT")) {
      console.warn("Only GMs and Assistant GMs can modify token values");
      return;
    }
    
    const actor = this.selectedToken.actor;
    
    // Check if actor has health data
    if (!actor.system.health) {
      console.warn("This actor does not have health data");
      return;
    }
    
    const currentHP = parseInt(actor.system.health.value) || 0;
    const maxHP = parseInt(actor.system.health.max) || 0;
    const newHP = Math.max(0, Math.min(maxHP, currentHP + delta));
    
    await actor.update({
      "system.health.value": newHP
    });
  }

  /**
   * Modify Hope or Stress value based on actor type
   */
  async modifyHopeOrStress(delta) {
    if (!this.selectedToken || !this.selectedToken.actor) return;
    
    // Check permissions
    if (!game.user.isGM && !game.user.hasRole("ASSISTANT")) {
      console.warn("Only GMs and Assistant GMs can modify token values");
      return;
    }
    
    const actor = this.selectedToken.actor;
    
    // For characters, modify Hope
    if (this.actorType === 'character') {
      // Check if actor has hope data
      if (!actor.system.hope) {
        console.warn("This actor does not have hope data");
        return;
      }
      
      const currentHope = parseInt(actor.system.hope.value) || 0;
      const maxHope = parseInt(actor.system.hope.max) || 0;
      const newHope = Math.max(0, Math.min(maxHope, currentHope + delta));
      
      await actor.update({
        "system.hope.value": newHope
      });
    }
    // For NPCs (Adversaries), modify Stress
    else if (this.actorType === 'npc') {
      // Check if actor has stress data
      if (!actor.system.stress) {
        console.warn("This actor does not have stress data");
        return;
      }
      
      const currentStress = parseInt(actor.system.stress.value) || 0;
      const maxStress = parseInt(actor.system.stress.max) || 0;
      const newStress = Math.max(0, Math.min(maxStress, currentStress + delta));
      
      await actor.update({
        "system.stress.value": newStress
      });
    }
  }

  /**
   * Update the counter display
   */
  updateDisplay() {
    if (!this.hpElement || !this.hopeElement) return;
    
    // Update HP display
    const hpValue = this.hpElement.querySelector(".hp-value");
    if (hpValue) {
      hpValue.textContent = `${this.hp.current}/${this.hp.max}`;
    }
    
    // Update Hope/Stress display
    const hopeStressValue = this.hopeElement.querySelector(".hope-stress-value");
    const hopeStressLabel = this.hopeElement.querySelector(".hope-stress-label");
    
    if (hopeStressValue && hopeStressLabel) {
      if (this.actorType === 'character') {
        hopeStressValue.textContent = `${this.hope.current}/${this.hope.max}`;
        hopeStressLabel.textContent = "Hope";
      } else if (this.actorType === 'npc') {
        hopeStressValue.textContent = `${this.stress.current}/${this.stress.max}`;
        hopeStressLabel.textContent = "Stress";
      }
    }
  }

  /**
   * Show the counter UI
   */
  show() {
    if (this.hpElement) {
      this.hpElement.style.display = "flex";
    }
    if (this.hopeElement) {
      this.hopeElement.style.display = "flex";
    }
  }

  /**
   * Hide the counter UI
   */
  hide() {
    if (this.hpElement) {
      this.hpElement.style.display = "none";
    }
    if (this.hopeElement) {
      this.hopeElement.style.display = "none";
    }
  }
} 