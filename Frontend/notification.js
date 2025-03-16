// notifications.js

async function checkForPendingDeals() {
    const userEmail = localStorage.getItem('email');

    if (!userEmail) {
        return; // Utilizator neautentificat, nu face nimic
    }

    try {
        const response = await fetch(`http://localhost:5000/checkdeals?email=${encodeURIComponent(userEmail)}`);
        const data = await response.json();

        if (!response.ok) {
            console.error("Eroare la verificarea deal-urilor:", data.message);
            return;
        }

        const pendingDeals = data.pendingDeals;

        if (pendingDeals.length > 0) {
            pendingDeals.forEach(deal => {
                showDealNotification(deal);
            });
        }

    } catch (error) {
        console.error('Eroare la fetch-ul deal-urilor pending:', error);
    }
}

function showDealNotification(deal) {
    if (document.getElementById(`deal-popup-${deal._id}`)) return;

    const notification = document.createElement('div');
    notification.id = `deal-popup-${deal._id}`;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.background = 'white';
    notification.style.padding = '20px';
    notification.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
    notification.style.borderRadius = '10px';
    notification.style.zIndex = '9999';
    notification.style.width = '300px';
    notification.innerHTML = `
        <p><strong>${deal.from}</strong> vrea să încheie un deal la anunțul <strong>${deal.announcementId}</strong>.</p>
        <button onclick="respondToDeal('${deal._id}', 'confirmed')">Acceptă</button>
        <button onclick="respondToDeal('${deal._id}', 'refused')">Refuză</button>
    `;

    document.body.appendChild(notification);
}

async function respondToDeal(dealId, action) {
    try {
        const response = await fetch(`http://localhost:5000/dealresponse`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dealId: dealId,
                newStatus: action
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Ai ${action === 'confirmed' ? 'acceptat' : 'refuzat'} cererea!`);
            const popup = document.getElementById(`deal-popup-${dealId}`);
            if (popup) popup.remove();
        } else {
            alert(`Eroare: ${data.message}`);
        }

    } catch (error) {
        console.error('Eroare la răspuns deal:', error);
    }
}

// Rulează la fiecare 2 secunde
setInterval(checkForPendingDeals, 2000);
