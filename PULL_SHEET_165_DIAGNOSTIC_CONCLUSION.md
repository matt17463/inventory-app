# Pull Sheet 165 Diagnostic Conclusion

The movement-attribution audit found exact timestamp matches:

- Movement 960 matches job item 215, job 165.
- Movement 962 matches job item 213, job 163.
- Movement 963 matches job item 214, job 164.

All three movements are quantity -1 for the Under Armour backpack and each
matches the corresponding job-item update and reservation release timestamp
to the microsecond.

Therefore:

- Pull sheet 165 already deducted one backpack.
- The additional two deductions belong to other orders.
- The current on-hand quantity of 1 is correct.
- Job item 215 requires a status-only repair.
- Running the old completion action again would risk an additional deduction.
