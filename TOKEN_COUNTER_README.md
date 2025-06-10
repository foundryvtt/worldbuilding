# Token Counter UI Documentation

## Overview
The Token Counter UI is an extension of the Fear counter system that displays HP and Hope/Stress values for the currently selected token on the canvas.

## Features
- **Automatic Display**: Counters appear when a token is selected and hide when no token is selected
- **HP Counter**: Displays to the left of the Fear counter, showing current/max format (e.g., "6/10")
- **Hope/Stress Counter**: Displays to the right of the Fear counter
  - Shows **Hope** for Player Characters (e.g., "2/5")
  - Shows **Stress** for NPCs/Adversaries (e.g., "3/6")
- **Permission-Based Controls**: Only GMs and Assistant GMs can modify values using the +/- buttons
- **Real-time Updates**: Values update automatically when the token's actor data changes
- **Smart Actor Detection**: Automatically switches between Hope and Stress based on actor type

## Usage

### For Players
- Select a token on the canvas to view its HP and Hope/Stress values
- The counters will appear above the hotbar, alongside the Fear counter
- Players can see the values but cannot modify them

### For GMs/Assistant GMs
- Select any token to view and modify its HP and Hope/Stress values
- Click the **+** button to increase a value
- Click the **-** button to decrease a value
- Values are clamped between 0 and their maximum

## Layout
```
Player Character Tokens:
[HP Counter] [Fear Counter] [Hope Counter]
     |             |              |
  HP: 6/10    Fear: 3       Hope: 2/5

NPC/Adversary Tokens:
[HP Counter] [Fear Counter] [Stress Counter]
     |             |               |
  HP: 8/12    Fear: 3       Stress: 4/6
```

## Technical Details
- The counters integrate with the existing counter UI system
- Character tokens display Hope, NPC tokens display Stress
- NPCs without health/stress data will have it initialized to 0/0
- All counters share the same styling for consistency
- The system uses Foundry's hooks to track token selection
- Event handling is properly isolated between counters to prevent interference

## Files Modified
- `module/token-counter-ui.js` - New file containing the token counter logic
- `module/simple.js` - Modified to initialize the token counter system
- `module/counter-ui.js` - Fixed event handling to use ID selectors
- `styles/simple.css` - Added styles for the token counters

## Known Issues Resolved
- Fixed: Token counter interactions no longer affect the Fear counter
- Fixed: NPCs properly display Stress instead of Hope
- Fixed: Missing health/stress data is properly initialized for NPCs

## Troubleshooting
- If counters don't appear, ensure a token is selected on the canvas
- If values show as "0/0" for NPCs, check if the NPC sheet has health/stress values set
- Ensure you have GM or Assistant GM permissions to modify values
- Check the console for any error messages if counters aren't working as expected 