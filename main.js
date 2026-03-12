const fs = require("fs");
//Helper(1)
function timeToSeconds(timeStr) {
    let [time, period] = timeStr.toLowerCase().split(" "); //split _:_:_ am/pm
    let [hours, minutes, seconds] = time.split(":").map(Number); //string -> number

    // handles invalid inputs
     if (hours < 1 || hours > 12 ||minutes < 0 || minutes > 59 ||seconds < 0 || seconds > 59 ||
        (period !== "am" && period !== "pm")
    ) {
        throw new Error("Invalid time format");
    }

    // convert to 24 hour format
    if (period === "pm" && hours !== 12) {
        hours += 12;
    }
    if (period === "am" && hours === 12) {
        hours = 0;
    }

    return (hours * 3600) + (minutes * 60) + seconds;
}
//Helper(2)
function formatTime(totalSeconds){

    //handles invalid/negative inputs
     if (totalSeconds < 0) {
        totalSeconds = 0;
    }

    let hours = parseInt(totalSeconds / 3600);
    totalSeconds = totalSeconds % 3600; //to get the remaining seconds after removing the hours

    let min = parseInt(totalSeconds / 60);
    let sec = totalSeconds % 60; //to get the remaining seconds after removing the minutes

    // to ensure hh:mm:ss format
    if (min < 10) min = "0" + min;
    if (sec < 10) sec = "0" + sec;

    return hours + ":" + min + ":" + sec;
}

//Helper(3)
function isEid(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return year === 2025 && month === 4 && day >= 10 && day <= 30;
}
//Helper(4)
function getDailyQuotaSec(dateStr) {
    if (isEid(dateStr)) {
        return (6 * 3600);
    } else {
        return (8 * 3600) + (24 * 60);
    }
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    let start = timeToSeconds(startTime);
    let end = timeToSeconds(endTime);

    if (end < start) {
        end = end + (24 * 3600);
    }
    let diff = end - start;

    return formatTime(diff);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    let start = timeToSeconds(startTime);
    let end = timeToSeconds(endTime);

    // if start after 10 pm and end before 8 am 
    if(end < start){
        end = end + (24 * 3600);
    }

    // delivery boundries
    let delStart = 8 * 3600;   // 8 AM
    let delEnd = 22 * 3600;    // 10 PM

    let idle = 0;

    // idle before 8am
    if(start < delStart){
        idle = idle + (Math.min(end, delStart) - start);
    }

    // idle after 10pm
    if(end > delEnd){
        idle = idle + (end - Math.max(start, delEnd));
    }

    return formatTime(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    // converting shiftDuration to seconds
    let [hour1, min1, sec1] = shiftDuration.split(":").map(Number);
    let shift = (hour1 * 3600) + (min1 * 60) + sec1;

    // converting idleTime to seconds
    let [hour2, min2, sec2] = idleTime.split(":").map(Number);
    let idle = (hour2 * 3600) + (min2 * 60) + sec2;

    // to avoid negative active time will print 0 (incorrect input)
    let active = Math.max(0, shift - idle);
    return formatTime(active);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    let [hour, min, sec] = activeTime.split(":").map(Number);
    let activeSec = (hour * 3600) +(min * 60) + sec;

    let quotaSec = getDailyQuotaSec(date);

    return activeSec >= quotaSec;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    // to read the file
    let data = fs.readFileSync(textFile, 'utf8');
    let lines = data.trim().split('\n');

    // to check duplicate (driverID &  date)
    for (let i = 1; i < lines.length; i++) {

        let cols = lines[i].split(',');

        if (cols[0] === shiftObj.driverID && cols[2] === shiftObj.date) {
            return {};
        }
    }

    // calculate the fields
    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let metQ = metQuota(shiftObj.date, activeTime);
    let hasBonus = false;

    // create a new row
    let newLine = [
        shiftObj.driverID,
        shiftObj.driverName,
        shiftObj.date,
        shiftObj.startTime,
        shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        metQ,
        hasBonus
    ].join(',');

    // to find the insertion index
    let insertIndex = lines.length;

    for (let i = lines.length - 1; i >= 1; i--) {

        let cols = lines[i].split(',');

        if (cols[0] === shiftObj.driverID) {
            insertIndex = i + 1;
            break;
        }
    }

    // to insert the row
    lines.splice(insertIndex, 0, newLine);

    let newData = lines.join('\n') + '\n';

    fs.writeFileSync(textFile, newData);

    // to return object
    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: metQ,
        hasBonus: hasBonus
    };
}


// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    // to read the file
    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.trim().split("\n");

    for (let i = 1; i < lines.length; i++) {

        let cols = lines[i].split(",");

        if (cols[0] === driverID && cols[2] === date) {
            //updating hasBonus
            cols[9] = newValue.toString();
            lines[i] = cols.join(",");
            break;
        }
    }

    fs.writeFileSync(textFile, lines.join("\n") + "\n");
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // TODO: Implement this function
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
