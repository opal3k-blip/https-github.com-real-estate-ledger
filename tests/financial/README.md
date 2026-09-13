# Financial Model Validation

The validation suite covers the high-risk underwriting paths identified in Stage 7:

- Base development
- Senior / Mezz
- Capitalized construction interest
- Refinance
- Off-plan escrow lag
- Phased subdivision sale
- Mixed sell + rent
- Fund / investor fees
- VAT treatment
- Landbank debt interest
- Maximum acquisition price
- Sensitivity
- Optimizer
- IC Decision Gate / Project IRR

`src/core.js` is a browser module, so the executable smoke harness is run in a browser context. The independent control formulas should be maintained separately from the engine and compared by tolerance, rather than asserting the engine against its own outputs.
