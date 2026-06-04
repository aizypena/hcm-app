// seed.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ---------- Manual timezone helpers (copied from your backend) ----------
function getTimezoneOffset(timezone, date) {
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

// ---------- Computation logic (same as backend) ----------
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

async function computeAndStoreSummary(userId, dateStr, schedule, timezone, inUTC, outUTC) {
    const metrics = computeMetrics(inUTC, outUTC, schedule, timezone);
    const summary = {
        userId,
        date: dateStr,
        incomplete: false,
        ...metrics,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('dailySummary').doc(`${userId}_${dateStr}`).set(summary, { merge: true });
    console.log(`Summary for ${dateStr}:`, metrics);
    return summary;
}

async function seed() {
    console.log('🌱 Starting seeder...');

    // 1. Create a test user
    const testUser = {
        email: 'test@example.com',
        password: 'test123',
        firstName: 'Test',
        lastName: 'User',
        role: 'employee',
        timezone: 'Asia/Manila',
        schedule: { start: '09:00', end: '18:00' }
    };

    let userId;
    try {
        const userRecord = await admin.auth().getUserByEmail(testUser.email);
        userId = userRecord.uid;
        console.log(`User ${testUser.email} already exists, UID: ${userId}`);
    } catch (err) {
        const userRecord = await admin.auth().createUser({
            email: testUser.email,
            password: testUser.password,
            displayName: `${testUser.firstName} ${testUser.lastName}`
        });
        userId = userRecord.uid;
        console.log(`Created new user, UID: ${userId}`);
    }

    // Store/update user data in Firestore
    await db.collection('users').doc(userId).set({
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        email: testUser.email,
        role: testUser.role,
        timezone: testUser.timezone,
        schedule: testUser.schedule
    });
    console.log('User data saved to Firestore');

    // 2. Define test scenarios (local date/time strings)
    const testScenarios = [
        {
            date: '2026-06-01',
            inLocal: '2026-06-01T09:00:00',
            outLocal: '2026-06-01T18:00:00',
            description: 'Normal day (no late, no undertime, no OT)'
        },
        {
            date: '2026-06-02',
            inLocal: '2026-06-02T09:30:00',
            outLocal: '2026-06-02T17:30:00',
            description: 'Late + undertime'
        },
        {
            date: '2026-06-03',
            inLocal: '2026-06-03T09:00:00',
            outLocal: '2026-06-03T20:00:00',
            description: 'Overtime (2 hrs)'
        },
        {
            date: '2026-06-04',
            inLocal: '2026-06-04T22:00:00',
            outLocal: '2026-06-05T06:00:00',
            description: 'Night differential (full night shift)'
        }
    ];

    const timezone = testUser.timezone;

    for (const scenario of testScenarios) {
        // Convert local strings to Date objects (interpreted as local time)
        const inLocalDate = new Date(scenario.inLocal);
        const outLocalDate = new Date(scenario.outLocal);
        // Convert to UTC using manual function
        const inUTC = toUtc(inLocalDate, timezone);
        const outUTC = toUtc(outLocalDate, timezone);

        // Store punches in Firestore (as Timestamps)
        await db.collection('attendance').add({
            userId,
            type: 'in',
            timestamp: admin.firestore.Timestamp.fromDate(inUTC)
        });
        await db.collection('attendance').add({
            userId,
            type: 'out',
            timestamp: admin.firestore.Timestamp.fromDate(outUTC)
        });
        console.log(`Added punches for ${scenario.date}: ${scenario.description}`);

        // Compute and store summary
        await computeAndStoreSummary(
            userId,
            scenario.date,
            testUser.schedule,
            timezone,
            inUTC,
            outUTC
        );
    }

    console.log('✅ Seeding complete! Check Firestore `dailySummary` collection.');
}

seed().catch(console.error);