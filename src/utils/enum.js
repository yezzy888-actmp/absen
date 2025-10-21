// src/utils/enum.js
const Role = {
  STUDENT: "STUDENT",
  TEACHER: "TEACHER",
  ADMIN: "ADMIN",
};

const AttendanceStatus = {
  HADIR: "HADIR",
  IZIN: "IZIN",
  SAKIT: "SAKIT",
  ALPHA: "ALPHA",
};

const ScoreType = {
  UTS: "UTS",
  UAS: "UAS",
  TUGAS: "TUGAS",
};

const Weekday = {
  SENIN: "SENIN",
  SELASA: "SELASA",
  RABU: "RABU",
  KAMIS: "KAMIS",
  JUMAT: "JUMAT",
  SABTU: "SABTU",
};

const Gender = {
  LAKI_LAKI: "LAKI_LAKI",
  PEREMPUAN: "PEREMPUAN",
};

module.exports = {
  Role,
  AttendanceStatus,
  ScoreType,
  Weekday,
  Gender,
};
