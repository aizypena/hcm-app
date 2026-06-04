const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ---------- Helper: get timezone offset (minutes) from IANA string ----------
function getTimezoneOffset(timezone, date) {
    // Fallback to UTC if we can't compute offset
    try {
        const tzString = new Date(date).toLocaleString('en-US', { timeZone: timezone });
        const utcString = new Date(date).toLocaleString('en-US', { timeZone: 'UTC' });
        const offset = (new Date(tzString) - new Date(utcString)) / 60000;
        return offset;
    } catch (err) {
        console.warn(`Could not get offset for ${timezone}, using 0`);
        return 0;
    }
}

function toUtc(date, timezone) {
    const offsetMinutes = getTimezoneOffset(timezone, date);
    return new Date(date.getTime() - offsetMinutes * 60000);
}

function toLocal(date, timezone) {
    const offsetMinutes = getTimezoneOffset(timezone, date);
    return new Date(date.getTime() + offsetMinutes * 60000);
}

// ---------- Helper: compute all metrics ----------
function computeMetrics(inTime, outTime, schedule, timezone) {
    const inLocal = toLocal(inTime, timezone);
    const outLocal = toLocal(outTime, timezone);

    const [startHour, startMin] = schedule.start.split(':').map(Number);
    const [endHour, endMin] = schedule.end.split(':').map(Number);

    let shiftStartLocal = new Date(inLocal);
    shiftStartLocal.setHours(startHour, startMin, 0, 0);

    let shiftEndLocal = new Date(inLocal);
    shiftEndLocal.setHours(endHour, endMin, 0, 0);
    if (shiftEndLocal <= shiftStartLocal) {
        shiftEndLocal = new Date(shiftEndLocal.getTime() + 24 * 3600000);
    }

    let lateMinutes = 0;
    if (inLocal > shiftStartLocal) lateMinutes = (inLocal - shiftStartLocal) / 60000;

    let undertimeMinutes = 0;
    if (outLocal < shiftEndLocal) undertimeMinutes = (shiftEndLocal - outLocal) / 60000;

    const workStart = inLocal > shiftStartLocal ? inLocal : shiftStartLocal;
    const workEnd = outLocal < shiftEndLocal ? outLocal : shiftEndLocal;
    let regularMinutes = 0;
    if (workEnd > workStart) regularMinutes = (workEnd - workStart) / 60000;

    let overtimeMinutes = 0;
    if (outLocal > shiftEndLocal) overtimeMinutes = (outLocal - shiftEndLocal) / 60000;

    function getNightDiffMinutes(start, end) {
        let total = 0;
        let current = new Date(start);
        const endDate = new Date(end);
        while (current < endDate) {
            let nightStart = new Date(current);
            nightStart.setHours(22, 0, 0, 0);
            let nightEnd = new Date(current);
            nightEnd.setDate(nightEnd.getDate() + 1);
            nightEnd.setHours(6, 0, 0, 0);
            if (nightStart < current) nightStart = current;
            if (nightEnd > endDate) nightEnd = endDate;
            if (nightEnd > nightStart) total += (nightEnd - nightStart) / 60000;
            current = new Date(nightEnd);
        }
        return total;
    }
    const ndMinutes = getNightDiffMinutes(inLocal, outLocal);

    return {
        regularHours: regularMinutes / 60,
        overtimeHours: overtimeMinutes / 60,
        nightDiffHours: ndMinutes / 60,
        lateMinutes,
        undertimeMinutes,
    };
}

// ---------- Middleware to verify admin token ----------
async function isAdmin(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (userDoc.exists && userDoc.data().role === 'admin') {
      req.user = decoded;
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: admin only' });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ---------- Compute daily summary ----------
app.post('/computeDailySummary', async (req, res) => {
    const { userId, dateStr } = req.body;
    console.log('computeDailySummary called:', userId, dateStr);
    if (!userId || !dateStr) return res.status(400).json({ error: 'Missing userId or date' });

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
        const { schedule, timezone } = userDoc.data();

        // Convert dateStr to UTC range for query
        const date = new Date(dateStr + 'T00:00:00');
        const startUTC = toUtc(date, timezone);
        const endUTC = new Date(startUTC.getTime() + 24 * 3600000 - 1);

        const punchesSnap = await db.collection('attendance')
            .where('userId', '==', userId)
            .where('timestamp', '>=', startUTC)
            .where('timestamp', '<=', endUTC)
            .get();

        let inTime = null, outTime = null;
        punchesSnap.forEach(doc => {
            const data = doc.data();
            const ts = data.timestamp.toDate();
            if (data.type === 'in') inTime = ts;
            if (data.type === 'out') outTime = ts;
        });

        if (!inTime || !outTime) {
            await db.collection('dailySummary').doc(`${userId}_${dateStr}`).set({
                userId, date: dateStr, incomplete: true,
                regularHours: 0, overtimeHours: 0, nightDiffHours: 0, lateMinutes: 0, undertimeMinutes: 0
            });
            return res.json({ status: 'incomplete' });
        }

        const metrics = computeMetrics(inTime, outTime, schedule, timezone);
        const summary = { userId, date: dateStr, incomplete: false, ...metrics, updatedAt: new Date() };
        await db.collection('dailySummary').doc(`${userId}_${dateStr}`).set(summary, { merge: true });
        res.json(summary);
    } catch (err) {
        console.error('Error in computeDailySummary:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------- Get daily summaries for a user (history) ----------
app.get('/dailySummaries/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snap = await db.collection('dailySummary')
            .where('userId', '==', userId)
            .get();
        const summaries = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (data.date) summaries.push({ id: doc.id, ...data });
        });
        summaries.sort((a, b) => b.date.localeCompare(a.date));
        res.json(summaries);
    } catch (err) {
        console.error('Error in dailySummaries:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------- Admin: weekly report ----------
app.get('/admin/weeklyReport', isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Missing startDate or endDate' });
    }

    try {
        const summariesSnap = await db.collection('dailySummary')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();

        if (summariesSnap.empty) {
            return res.json([]);
        }

        const reportMap = new Map();
        summariesSnap.forEach(doc => {
            const data = doc.data();
            if (!data.userId || !data.date) return;
            if (!reportMap.has(data.userId)) reportMap.set(data.userId, []);
            reportMap.get(data.userId).push(data);
        });

        const userIds = [...reportMap.keys()];
        if (userIds.length === 0) return res.json([]);

        // Fetch all users and filter in memory (simpler, no FieldPath issues)
        const allUsersSnap = await db.collection('users').get();
        const userMap = {};
        allUsersSnap.forEach(doc => {
            const data = doc.data();
            userMap[doc.id] = {
                firstName: data.firstName || '',
                lastName: data.lastName || ''
            };
        });

        const result = Array.from(reportMap.entries()).map(([uid, days]) => ({
            userId: uid,
            firstName: userMap[uid]?.firstName || '',
            lastName: userMap[uid]?.lastName || '',
            days
        }));

        res.json(result);
    } catch (err) {
        console.error('Error in admin/weeklyReport:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

app.get('/admin/users', isAdmin, async (req, res) => {
  try {
    const allUsersSnap = await db.collection('users').get();
    const users = [];
    allUsersSnap.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role
      });
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Admin: get all punches ----------
app.get('/admin/punches', isAdmin, async (req, res) => {
    const { userId, date } = req.query;
    try {
        let query = db.collection('attendance');
        if (userId) query = query.where('userId', '==', userId);
        if (date) {
            const start = new Date(date + 'T00:00:00');
            const end = new Date(date + 'T23:59:59');
            query = query.where('timestamp', '>=', start).where('timestamp', '<=', end);
        }
        const snap = await query.get();
        const punches = [];
        snap.forEach(doc => punches.push({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp.toDate() }));
        res.json(punches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/admin/punch/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { type, timestamp } = req.body;
    await db.collection('attendance').doc(id).update({ type, timestamp: new Date(timestamp) });
    res.json({ success: true });
});

app.delete('/admin/punch/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    await db.collection('attendance').doc(id).delete();
    res.json({ success: true });
});

exports.api = functions.https.onRequest(app);
