-- CreateTriggers: Add immutability triggers for ledger entries and transactions

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS prevent_ledger_entry_updates;
DROP TRIGGER IF EXISTS prevent_ledger_entry_deletes;
DROP TRIGGER IF EXISTS prevent_completed_transaction_updates;

-- Trigger 1: Prevent updates on ledger_entries table
CREATE TRIGGER prevent_ledger_entry_updates
BEFORE UPDATE ON ledger_entries
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries are immutable - updates not allowed';
END;

-- Trigger 2: Prevent deletes on ledger_entries table
CREATE TRIGGER prevent_ledger_entry_deletes
BEFORE DELETE ON ledger_entries
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries are immutable - deletes not allowed';
END;

-- Trigger 3: Prevent updates on completed transactions
CREATE TRIGGER prevent_completed_transaction_updates
BEFORE UPDATE ON transactions
FOR EACH ROW
BEGIN
    IF OLD.status = 'COMPLETED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Completed transactions cannot be modified';
    END IF;
END;