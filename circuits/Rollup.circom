pragma circom 2.0.0;

// These two circuits are included during the compilation process
include "comparators.circom";
include "multiplexer.circom";

template Transaction() {
    signal input amount;
    signal input oldSenderBalance;
    signal input oldReceiverBalance;
    
    signal output newSenderBalance;
    signal output newReceiverBalance;

    component geq = GreaterEqThan(252);
    geq.in[0] <== oldSenderBalance;
    geq.in[1] <== amount;
    geq.out === 1; // oldSenderBalance >= amount

    newSenderBalance <== oldSenderBalance - amount;
    newReceiverBalance <== oldReceiverBalance + amount;
}

template AccountBalanceUpdater() {
    signal input senderBalance;
    signal input receiverBalance;
    signal input defaultBalance;
    signal input isSender;
    signal input isReceiver;
    
    signal output newBalance;

    component selector = Multiplexer(1, 3); // 3 possibilities: sender, receiver, or unchanged
    selector.inp[0][0] <== senderBalance;
    selector.inp[1][0] <== receiverBalance;
    selector.inp[2][0] <== defaultBalance;
    selector.sel <== 2 - (2 * isSender + isReceiver);
    newBalance <== selector.out[0];
}

template Rollup(nTx, nAcc) {
    signal input startingBalance[nAcc]; // Initial balances
    signal input transactions[nTx][3]; // Array of [sender, receiver, amount]
    signal output finalBalance[nAcc]; // Final balances after all transactions

    signal intermediateStates[nTx + 1][nAcc];
    for (var i = 0; i < nAcc; i++) {
        intermediateStates[0][i] <== startingBalance[i];
    }

    // Process each transaction
    component transactionComponent[nTx];
    component senderSelector[nTx];
    component receiverSelector[nTx];
    component accountBalanceUpdater[nTx][nAcc];

    for (var i = 0; i < nTx; i++) {
        // Create multiplexers with wIn=1 (single value) and nIn=nAcc (number of accounts)
        senderSelector[i] = Multiplexer(1, nAcc);
        receiverSelector[i] = Multiplexer(1, nAcc);
        // Prepare inputs in the required format [nIn][wIn]
        for (var j = 0; j < nAcc; j++) {
            senderSelector[i].inp[j][0] <== intermediateStates[i][j];
            receiverSelector[i].inp[j][0] <== intermediateStates[i][j];
        }

        // Select the correct balances
        senderSelector[i].sel <== transactions[i][0];
        receiverSelector[i].sel <== transactions[i][1];

        transactionComponent[i] = Transaction();
        transactionComponent[i].amount <== transactions[i][2];
        transactionComponent[i].oldSenderBalance <== senderSelector[i].out[0];
        transactionComponent[i].oldReceiverBalance <== receiverSelector[i].out[0];
        
        for (var j = 0; j < nAcc; j++) {
            accountBalanceUpdater[i][j] = AccountBalanceUpdater();
            accountBalanceUpdater[i][j].senderBalance <== transactionComponent[i].newSenderBalance;
            accountBalanceUpdater[i][j].receiverBalance <== transactionComponent[i].newReceiverBalance;
            accountBalanceUpdater[i][j].defaultBalance <== intermediateStates[i][j];
            accountBalanceUpdater[i][j].isSender <== IsEqual()([j, transactions[i][0]]);
            accountBalanceUpdater[i][j].isReceiver <== IsEqual()([j, transactions[i][1]]);
            intermediateStates[i+1][j] <== accountBalanceUpdater[i][j].newBalance;
        }
    }
    for (var i = 0; i < nAcc; i++) {
        finalBalance[i] <== intermediateStates[nTx][i];
    }
}

component main {public [startingBalance, transactions]} = Rollup(100, 10);