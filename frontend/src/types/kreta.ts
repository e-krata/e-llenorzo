export interface AccountInfo {
  id: string;
  name: string;
  username: string;
  instituteCode: string;
  instituteName: string;
  isActive: boolean;
}

export interface LocalProfile {
  nickname: string;
  avatarB64: string;
}

export interface StudentDetail {
  uid: string;
  name: string;
  birthName: string;
  birthPlace: string;
  birthDate: string;
  mothersName: string;
  email: string;
  phone: string;
  address: string;
  instituteName: string;
  instituteCode: string;
  gradeDelay: number;
}

export interface Grade {
  uid: string;
  date: string;
  writeDate: string;
  subjectUid: string;
  subjectName: string;
  value: number;
  valueText: string;
  weight: number;
  topic: string;
  teacher: string;
  typeUid: string;
  typeName: string;
  isPercentage: boolean;
}

export interface Lesson {
  uid: string;
  date: string;
  start: string;
  end: string;
  periodIndex: number;
  subjectUid: string;
  subjectName: string;
  teacher: string;
  substituteTeacher: string;
  room: string;
  description: string;
  name: string;
  statusName: string;
  isCancelled: boolean;
  isOnline: boolean;
  homeworkUid: string;
  groupName: string;
  yearIndex: number;
}

export interface Homework {
  uid: string;
  date: string;
  lessonDate: string;
  deadline: string;
  content: string;
  subjectUid: string;
  subjectName: string;
  teacher: string;
}

export interface TestEntry {
  uid: string;
  date: string;
  subjectName: string;
  type: "zh" | "dolgozat" | "szobeli";
  topic: string;
  teacher: string;
}

export interface SubjectAbsence {
  subjectName: string;
  usedHours: number;
  maxHours: number;
}

export interface BellPeriod {
  periodIndex: number;
  start: string;
  end: string;
}
