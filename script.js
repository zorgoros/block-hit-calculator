document.addEventListener('DOMContentLoaded', () => {
    const cryptoSelect = document.getElementById('crypto');
    const cryptoSearch = document.getElementById('crypto-search');
    const hashrateInput = document.getElementById('hashrate');
    const hashrateUnitSelect = document.getElementById('hashrate-unit');
    const calculateButton = document.getElementById('calculate');
    const timeToFindSpan = document.getElementById('time-to-find');
    const dailyEarningsSpan = document.getElementById('daily-earnings');
    const currentPriceSpan = document.getElementById('current-price');
    const dailyEarningsUsdSpan = document.getElementById('daily-earnings-usd');
    const errorSpan = document.getElementById('error-message'); // This is fine, but we'll also use it

    const poolFeeInput = document.getElementById('pool-fee');

    const popularCoins = {
        'SHA-256': [
            { name: 'Bitcoin', symbol: 'BTC' },
            { name: 'Bitcoin Cash', symbol: 'BCH' },
        ],
        'Scrypt': [
            { name: 'Litecoin', symbol: 'LTC' },
            { name: 'Dogecoin', symbol: 'DOGE' },
        ],
        'Ethash': [
            { name: 'Ethereum Classic', symbol: 'ETC' },
        ],
        'X11': [
            { name: 'Dash', symbol: 'DASH' },
        ],
        'CryptoNight': [
            { name: 'Monero', symbol: 'XMR' },
        ],
        'Equihash': [
            { name: 'Zcash', symbol: 'ZEC' }
        ]
    };

    const HASHRATE_MULTIPLIERS = {
        'H/s': 1,
        'kH/s': 1e3,
        'MH/s': 1e6,
        'GH/s': 1e9,
        'TH/s': 1e12,
        'PH/s': 1e15,
        'EH/s': 1e18,
    };
    const DIFFICULTY_MULTIPLIER = 2 ** 32;

    let filteredCoins = popularCoins;
    let timeToFindInDays = 0;

    function populateDropdown(coins) {
        const selectedValue = cryptoSelect.value;
        cryptoSelect.innerHTML = '';
        for (const algorithm in coins) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = algorithm;
            coins[algorithm].forEach(coin => {
                const option = document.createElement('option');
                option.value = coin.symbol;
                option.textContent = coin.name;
                optgroup.appendChild(option);
            });
            cryptoSelect.appendChild(optgroup);
        }
        if (Array.from(cryptoSelect.options).some(opt => opt.value === selectedValue)) {
            cryptoSelect.value = selectedValue;
        }
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === 0) return 'Never';
        if (seconds < 60) return `${seconds.toFixed(1)} seconds`;
        const minutes = seconds / 60;
        if (minutes < 60) return `${minutes.toFixed(1)} minutes`;
        const hours = minutes / 60;
        if (hours < 24) return `${hours.toFixed(1)} hours`;
        const days = hours / 24;
        if (days < 30.437) return `${days.toFixed(1)} days`;
        const months = days / 30.437;
        if (months < 12) return `${months.toFixed(1)} months`;
        const years = days / 365.25;
        return `${years.toFixed(2)} years`;
    }

    function prefillFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const crypto = params.get('c');
        const hashrate = params.get('h');
        const unit = params.get('u');
        const fee = params.get('f');

        if (crypto) cryptoSelect.value = crypto;
        if (hashrate) hashrateInput.value = hashrate;
        if (unit) hashrateUnitSelect.value = unit;
        if (fee) poolFeeInput.value = fee;

        if (crypto && hashrate && unit) {
            calculateButton.click();
        }
    }

    populateDropdown(popularCoins);

    cryptoSearch.addEventListener('input', () => {
        const searchTerm = cryptoSearch.value.toLowerCase();
        filteredCoins = {};
        for (const algorithm in popularCoins) {
            const matchingCoins = popularCoins[algorithm].filter(coin =>
                coin.name.toLowerCase().includes(searchTerm) || coin.symbol.toLowerCase().includes(searchTerm)
            );
            if (matchingCoins.length > 0) {
                filteredCoins[algorithm] = matchingCoins;
            }
        }
        populateDropdown(filteredCoins);
    });

    prefillFromUrl(); // Run on page load

    calculateButton.addEventListener('click', async () => {
        // 1. Set loading state and clear previous results
        calculateButton.disabled = true;
        calculateButton.textContent = 'Calculating...';
        timeToFindSpan.textContent = '-';
        dailyEarningsSpan.textContent = '-';
        currentPriceSpan.textContent = '-';
        dailyEarningsUsdSpan.textContent = '-';
        errorSpan.textContent = '';


        try {
            const selectedCrypto = cryptoSelect.value;
            const userHashrateInput = parseFloat(hashrateInput.value);
            const hashrateUnit = hashrateUnitSelect.value;

            // 2. Validate inputs
            if (!selectedCrypto || isNaN(userHashrateInput) || userHashrateInput <= 0) {
                throw new Error('Please select a cryptocurrency and enter a valid hashrate.');
            }

            const userHashrate = userHashrateInput * (HASHRATE_MULTIPLIERS[hashrateUnit] || 1);

            const poolFeePercentage = Math.min(100, Math.max(0, parseFloat(poolFeeInput.value || '0')));
            const poolFee = poolFeePercentage / 100;

            const apiUrl = `https://api.minerstat.com/v2/coins?list=${selectedCrypto}`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`Network error: ${response.statusText}`);
            }
            const data = await response.json();

            const coinData = data[0];
            if (!coinData) {
                throw new Error(`Data for ${selectedCrypto} is not available.`);
            }

            // 3. Check if mineable
            if (coinData.is_mineable === false) {
                throw new Error(`${coinData.name} (${coinData.coin}) is not mineable.`);
            }

            const difficulty = parseFloat(coinData.difficulty);
            const blockReward = parseFloat(coinData.reward_block);
            const price = parseFloat(coinData.price);

            if (isNaN(difficulty) || isNaN(blockReward) || isNaN(price)) {
                throw new Error(`Incomplete data received for ${selectedCrypto}.`);
            }

            // 4. Perform calculations
            const timeToFindInSeconds = (difficulty * DIFFICULTY_MULTIPLIER) / userHashrate;
            const dailyEarnings = (userHashrate * blockReward * 86400) / (difficulty * DIFFICULTY_MULTIPLIER) * (1 - poolFee);

            // 5. Display results with smart formatting
            timeToFindSpan.textContent = formatTime(timeToFindInSeconds);
            dailyEarningsSpan.textContent = `${dailyEarnings.toFixed(6)} ${selectedCrypto}`;
            currentPriceSpan.textContent = `$${price.toFixed(2)}`;
            dailyEarningsUsdSpan.textContent = `$${(dailyEarnings * price).toFixed(2)}/day`;

            // 6. Update URL with current parameters
            const params = new URLSearchParams({
                c: selectedCrypto,
                h: userHashrateInput,
                u: hashrateUnit,
                f: poolFeePercentage
            });
            // Use replaceState to avoid polluting browser history
            history.replaceState(null, '', `?${params.toString()}`);

            
        } catch (error) {
            errorSpan.textContent = error.message;
            console.error('Error during calculation:', error);
        } finally {
            // 6. Reset loading state
            calculateButton.disabled = false;
            calculateButton.textContent = 'Calculate';
        }
    });
});