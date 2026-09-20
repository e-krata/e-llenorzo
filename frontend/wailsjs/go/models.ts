export namespace main {
	
	export class TaskItem {
	    id: string;
	    text: string;
	    done: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TaskItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.text = source["text"];
	        this.done = source["done"];
	    }
	}
	export class FuzetEntry {
	    id: string;
	    type: string;
	    title: string;
	    content: string;
	    items: TaskItem[];
	    imageData: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FuzetEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.title = source["title"];
	        this.content = source["content"];
	        this.items = this.convertValues(source["items"], TaskItem);
	        this.imageData = source["imageData"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace models {
	
	export class Absence {
	    uid: string;
	    date: string;
	    subjectUid: string;
	    subjectName: string;
	    isJustified: boolean;
	    typeName: string;
	
	    static createFrom(source: any = {}) {
	        return new Absence(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.date = source["date"];
	        this.subjectUid = source["subjectUid"];
	        this.subjectName = source["subjectName"];
	        this.isJustified = source["isJustified"];
	        this.typeName = source["typeName"];
	    }
	}
	export class AccountInfo {
	    id: string;
	    name: string;
	    username: string;
	    instituteCode: string;
	    instituteName: string;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AccountInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.username = source["username"];
	        this.instituteCode = source["instituteCode"];
	        this.instituteName = source["instituteName"];
	        this.isActive = source["isActive"];
	    }
	}
	export class BellPeriod {
	    periodIndex: number;
	    start: string;
	    end: string;
	
	    static createFrom(source: any = {}) {
	        return new BellPeriod(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.periodIndex = source["periodIndex"];
	        this.start = source["start"];
	        this.end = source["end"];
	    }
	}
	export class Change {
	    type: string;
	    content: string;
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new Change(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.content = source["content"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class Countdown {
	    id: number;
	    label: string;
	    targetDate: string;
	    visible: boolean;
	    daysRemaining: number;
	
	    static createFrom(source: any = {}) {
	        return new Countdown(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.targetDate = source["targetDate"];
	        this.visible = source["visible"];
	        this.daysRemaining = source["daysRemaining"];
	    }
	}
	export class Exam {
	    uid: string;
	    date: string;
	    subjectUid: string;
	    subjectName: string;
	    typeUid: string;
	    typeName: string;
	    description: string;
	    teacher: string;
	
	    static createFrom(source: any = {}) {
	        return new Exam(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.date = source["date"];
	        this.subjectUid = source["subjectUid"];
	        this.subjectName = source["subjectName"];
	        this.typeUid = source["typeUid"];
	        this.typeName = source["typeName"];
	        this.description = source["description"];
	        this.teacher = source["teacher"];
	    }
	}
	export class Grade {
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
	
	    static createFrom(source: any = {}) {
	        return new Grade(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.date = source["date"];
	        this.writeDate = source["writeDate"];
	        this.subjectUid = source["subjectUid"];
	        this.subjectName = source["subjectName"];
	        this.value = source["value"];
	        this.valueText = source["valueText"];
	        this.weight = source["weight"];
	        this.topic = source["topic"];
	        this.teacher = source["teacher"];
	        this.typeUid = source["typeUid"];
	        this.typeName = source["typeName"];
	        this.isPercentage = source["isPercentage"];
	    }
	}
	export class Homework {
	    uid: string;
	    date: string;
	    lessonDate: string;
	    deadline: string;
	    content: string;
	    subjectUid: string;
	    subjectName: string;
	    teacher: string;
	
	    static createFrom(source: any = {}) {
	        return new Homework(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.date = source["date"];
	        this.lessonDate = source["lessonDate"];
	        this.deadline = source["deadline"];
	        this.content = source["content"];
	        this.subjectUid = source["subjectUid"];
	        this.subjectName = source["subjectName"];
	        this.teacher = source["teacher"];
	    }
	}
	export class Institute {
	    instituteCode: string;
	    instituteName: string;
	    city: string;
	    instituteType: string;
	    url: string;
	    active: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Institute(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.instituteCode = source["instituteCode"];
	        this.instituteName = source["instituteName"];
	        this.city = source["city"];
	        this.instituteType = source["instituteType"];
	        this.url = source["url"];
	        this.active = source["active"];
	    }
	}
	export class Lesson {
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
	
	    static createFrom(source: any = {}) {
	        return new Lesson(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.date = source["date"];
	        this.start = source["start"];
	        this.end = source["end"];
	        this.periodIndex = source["periodIndex"];
	        this.subjectUid = source["subjectUid"];
	        this.subjectName = source["subjectName"];
	        this.teacher = source["teacher"];
	        this.substituteTeacher = source["substituteTeacher"];
	        this.room = source["room"];
	        this.description = source["description"];
	        this.name = source["name"];
	        this.statusName = source["statusName"];
	        this.isCancelled = source["isCancelled"];
	        this.isOnline = source["isOnline"];
	        this.homeworkUid = source["homeworkUid"];
	        this.groupName = source["groupName"];
	        this.yearIndex = source["yearIndex"];
	    }
	}
	export class LocalProfile {
	    nickname: string;
	    avatarB64: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nickname = source["nickname"];
	        this.avatarB64 = source["avatarB64"];
	    }
	}
	export class Notification {
	    id: number;
	    type: string;
	    content: string;
	    timestamp: string;
	    isRead: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Notification(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.content = source["content"];
	        this.timestamp = source["timestamp"];
	        this.isRead = source["isRead"];
	    }
	}
	export class StudentDetail {
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
	
	    static createFrom(source: any = {}) {
	        return new StudentDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.name = source["name"];
	        this.birthName = source["birthName"];
	        this.birthPlace = source["birthPlace"];
	        this.birthDate = source["birthDate"];
	        this.mothersName = source["mothersName"];
	        this.email = source["email"];
	        this.phone = source["phone"];
	        this.address = source["address"];
	        this.instituteName = source["instituteName"];
	        this.instituteCode = source["instituteCode"];
	        this.gradeDelay = source["gradeDelay"];
	    }
	}
	export class SubjectAbsenceStat {
	    subjectName: string;
	    usedHours: number;
	    maxHours: number;
	
	    static createFrom(source: any = {}) {
	        return new SubjectAbsenceStat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subjectName = source["subjectName"];
	        this.usedHours = source["usedHours"];
	        this.maxHours = source["maxHours"];
	    }
	}
	export class SubjectColor {
	    subject: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new SubjectColor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subject = source["subject"];
	        this.color = source["color"];
	    }
	}
	export class TeacherProfile {
	    name: string;
	    subjects: string[];
	    averageGrade: number;
	    gradeDistribution: Record<number, number>;
	    totalGrades: number;
	
	    static createFrom(source: any = {}) {
	        return new TeacherProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.subjects = source["subjects"];
	        this.averageGrade = source["averageGrade"];
	        this.gradeDistribution = source["gradeDistribution"];
	        this.totalGrades = source["totalGrades"];
	    }
	}

}

