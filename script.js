// Firebase Configuration (already setup)
const firebaseConfig = {
    apiKey: "AIzaSyDRSMYk4EQYN2wVRH_0MVaseBFO6v0zaxk",
    authDomain: "earning-app-eff29.firebaseapp.com",
    databaseURL: "https://earning-app-eff29-default-rtdb.firebaseio.com",
    projectId: "earning-app-eff29",
    storageBucket: "earning-app-eff29.firebasestorage.app",
    messagingSenderId: "283531541732",
    appId: "1:283531541732:web:e4a939752c2b75aa8fc0f1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Global variables
let currentUser = null;
let userData = null;
let today = new Date().toDateString();

// Check if user is logged in
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await initializeUser(user);
        showScreen('dashboardScreen');
        updateDashboard();
        startDailyResetCheck();
    } else {
        showScreen('loginScreen');
    }
});

// Generate unique referral code
function generateReferralCode(name, uid) {
    const prefix = name.substring(0, 3).toUpperCase();
    const suffix = uid.substring(0, 5).toUpperCase();
    return `${prefix}${suffix}`;
}

// Initialize user in database
async function initializeUser(user) {
    const userRef = database.ref('users/' + user.uid);
    const snapshot = await userRef.once('value');
    
    if (!snapshot.exists()) {
        // Check if user came from a referral
        const urlParams = new URLSearchParams(window.location.search);
        const referralCode = urlParams.get('ref');
        
        let referredBy = null;
        if (referralCode) {
            // Find user with this referral code
            const usersSnapshot = await database.ref('users').once('value');
            usersSnapshot.forEach((childSnapshot) => {
                if (childSnapshot.val().referralCode === referralCode) {
                    referredBy = childSnapshot.key;
                }
            });
        }
        
        const newUser = {
            uid: user.uid,
            name: user.displayName,
            email: user.email,
            coins: 0,
            referralCode: generateReferralCode(user.displayName, user.uid),
            referredBy: referredBy,
            lastCheckinDate: '',
            spinCountToday: 0,
            taskCountToday: 0,
            createdAt: new Date().toISOString()
        };
        
        await userRef.set(newUser);
        
        // Handle referral bonus
        if (referredBy) {
            await handleReferralBonus(referredBy, user.uid);
        }
    }
}

// Handle referral bonus
async function handleReferralBonus(referrerId, newUserId) {
    const referrerRef = database.ref('users/' + referrerId);
    const newUserRef = database.ref('users/' + newUserId);
    
    // Check if this referral was already rewarded
    const referralCheckRef = database.ref('referrals/' + referrerId + '/' + newUserId);
    const referralSnapshot = await referralCheckRef.once('value');
    
    if (!referralSnapshot.exists()) {
        // Add coins to referrer
        await referrerRef.transaction((user) => {
            if (user) {
                user.coins = (user.coins || 0) + 50;
            }
            return user;
        });
        
        // Add coins to new user
        await newUserRef.transaction((user) => {
            if (user) {
                user.coins = (user.coins || 0) + 50;
            }
            return user;
        });
        
        // Mark referral as rewarded
        await referralCheckRef.set({
            rewarded: true,
            timestamp: new Date().toISOString()
        });
        
        showCoinAnimation(50, 'Referral Bonus!');
    }
}

// Show screen
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Update dashboard with user data
async function updateDashboard() {
    if (!currentUser) return;
    
    const userRef = database.ref('users/' + currentUser.uid);
    userRef.on('value', (snapshot) => {
        userData = snapshot.val();
        if (userData) {
            // Update user info
            document.getElementById('userName').textContent = userData.name;
            document.getElementById('userEmail').textContent = userData.email;
            document.getElementById('userInitials').textContent = userData.name.charAt(0).toUpperCase();
            
            // Update coins
            document.getElementById('totalCoins').textContent = userData.coins || 0;
            const inrValue = ((userData.coins || 0) / 100).toFixed(2);
            document.getElementById('inrValue').textContent = inrValue;
            document.getElementById('availableCoins').textContent = userData.coins || 0;
            document.getElementById('convertInr').textContent = inrValue;
            
            // Update referral code
            document.getElementById('referralCode').textContent = userData.referralCode;
            
            // Update daily limits
            updateDailyStatus();
        }
    });
}

// Update daily check-in and spin status
function updateDailyStatus() {
    if (!userData) return;
    
    const today = new Date().toDateString();
    const checkinBtn = document.getElementById('checkinBtn');
    const checkinStatus = document.getElementById('checkinStatus');
    
    // Check-in status
    if (userData.lastCheckinDate === today) {
        checkinBtn.disabled = true;
        checkinBtn.textContent = 'Checked In';
        checkinStatus.textContent = '✓ Already checked in today';
    } else {
        checkinBtn.disabled = false;
        checkinBtn.textContent = 'Check In';
        checkinStatus.textContent = '';
    }
    
    // Spin status
    const spinsLeft = 50 - (userData.spinCountToday || 0);
    document.getElementById('spinsLeft').textContent = spinsLeft;
    document.getElementById('spinBtn').disabled = spinsLeft <= 0;
    
    // Tasks status
    const tasksLeft = 50 - (userData.taskCountToday || 0);
    document.getElementById('tasksCompleted').textContent = userData.taskCountToday || 0;
    document.getElementById('tasksProgress').style.width = `${((userData.taskCountToday || 0) / 50) * 100}%`;
    document.getElementById('taskBtn').disabled = tasksLeft <= 0;
}

// Show coin animation
function showCoinAnimation(amount, message = '') {
    const container = document.getElementById('coinAnimation');
    for (let i = 0; i < Math.min(amount / 10, 10); i++) {
        setTimeout(() => {
            const coin = document.createElement('div');
            coin.className = 'coin';
            coin.textContent = '🪙';
            coin.style.left = Math.random() * window.innerWidth + 'px';
            coin.style.top = Math.random() * window.innerHeight + 'px';
            container.appendChild(coin);
            
            setTimeout(() => {
                coin.remove();
            }, 1000);
        }, i * 100);
    }
    
    if (message) {
        alert(`+${amount} coins! ${message}`);
    }
}

// Daily check-in
document.getElementById('checkinBtn')?.addEventListener('click', async () => {
    if (!currentUser || !userData) return;
    
    const today = new Date().toDateString();
    if (userData.lastCheckinDate === today) {
        alert('You have already checked in today!');
        return;
    }
    
    const userRef = database.ref('users/' + currentUser.uid);
    await userRef.transaction((user) => {
        if (user) {
            user.coins = (user.coins || 0) + 20;
            user.lastCheckinDate = today;
        }
        return user;
    });
    
    showCoinAnimation(20, 'Daily Check-in Bonus!');
});

// Spin to earn
document.getElementById('spinBtn')?.addEventListener('click', async () => {
    if (!currentUser || !userData) return;
    
    if ((userData.spinCountToday || 0) >= 50) {
        alert('Daily spin limit reached!');
        return;
    }
    
    const reward = Math.floor(Math.random() * 46) + 5; // 5-50 coins
    
    const userRef = database.ref('users/' + currentUser.uid);
    await userRef.transaction((user) => {
        if (user) {
            user.coins = (user.coins || 0) + reward;
            user.spinCountToday = (user.spinCountToday || 0) + 1;
        }
        return user;
    });
    
    showCoinAnimation(reward, `You won ${reward} coins!`);
});

// Complete task
document.getElementById('taskBtn')?.addEventListener('click', async () => {
    if (!currentUser || !userData) return;
    
    if ((userData.taskCountToday || 0) >= 50) {
        alert('Daily task limit reached!');
        return;
    }
    
    const userRef = database.ref('users/' + currentUser.uid);
    await userRef.transaction((user) => {
        if (user) {
            user.coins = (user.coins || 0) + 10;
            user.taskCountToday = (user.taskCountToday || 0) + 1;
        }
        return user;
    });
    
    showCoinAnimation(10, 'Task Completed!');
    document.getElementById('taskMessage').textContent = 'Task completed! +10 coins';
    setTimeout(() => {
        document.getElementById('taskMessage').textContent = '';
    }, 3000);
});

// Copy referral code
document.getElementById('copyReferral')?.addEventListener('click', () => {
    const referralCode = document.getElementById('referralCode').textContent;
    navigator.clipboard.writeText(referralCode).then(() => {
        alert('Referral code copied!');
    });
});

// Withdrawal request
document.getElementById('withdrawBtn')?.addEventListener('click', async () => {
    if (!currentUser || !userData) return;
    
    const upiId = document.getElementById('upiId').value.trim();
    if (!upiId) {
        alert('Please enter UPI ID');
        return;
    }
    
    if (!upiId.includes('@')) {
        alert('Please enter a valid UPI ID');
        return;
    }
    
    const coins = userData.coins || 0;
    if (coins < 1000) {
        alert(`Minimum 1000 coins required for withdrawal. You have ${coins} coins.`);
        return;
    }
    
    const inrAmount = coins / 100;
    
    // Create withdrawal request
    const withdrawalRef = database.ref('withdrawals/' + currentUser.uid).push();
    await withdrawalRef.set({
        coins: coins,
        inrAmount: inrAmount,
        upiId: upiId,
        status: 'pending',
        requestedAt: new Date().toISOString()
    });
    
    // Deduct coins
    const userRef = database.ref('users/' + currentUser.uid);
    await userRef.transaction((user) => {
        if (user) {
            user.coins = 0;
        }
        return user;
    });
    
    document.getElementById('withdrawMessage').textContent = `Withdrawal request sent for ₹${inrAmount.toFixed(2)}!`;
    document.getElementById('upiId').value = '';
    setTimeout(() => {
        document.getElementById('withdrawMessage').textContent = '';
    }, 5000);
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await auth.signOut();
    showScreen('loginScreen');
});

// Google Sign In
document.getElementById('googleSignIn')?.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
});

// Check and reset daily limits
function startDailyResetCheck() {
    setInterval(() => {
        if (userData) {
            const lastReset = localStorage.getItem('lastDailyReset');
            const today = new Date().toDateString();
            
            if (lastReset !== today) {
                // Reset daily limits in database
                if (currentUser) {
                    const userRef = database.ref('users/' + currentUser.uid);
                    userRef.update({
                        spinCountToday: 0,
                        taskCountToday: 0
                    });
                }
                localStorage.setItem('lastDailyReset', today);
            }
        }
    }, 60000); // Check every minute
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for referral in URL
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    if (referralCode) {
        localStorage.setItem('pendingReferral', referralCode);
    }
});
