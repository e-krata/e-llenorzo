package models

import "time"

type Institute struct {
    InstituteCode string `json:"instituteCode"`
    InstituteName string `json:"instituteName"`
    City string `json:"city"`
    InstituteType string `json:"instituteType"`
    Url string `json:"url"`
    Active bool `json:"active"`
}

func (i Institute) BaseURL() string {
    if i.Url != "" {
        return i.Url
    }
    return "https://" + i.InstituteCode + ".megvellek.hu"
}

type TokenResponse struct {
    AccessToken string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    ExpiresIn int `json:"expires_in"`
    TokenType string `json:"token_type"`
    Error string `json:"error"`
    ErrorDescription string `json:"error_description"`
}

type Session struct {
    Institute Institute
    Username string
    AccessToken  string
    RefreshToken string
    ExpiresAt time.Time
}

func (s *Session) IsExpired() bool {
    return time.Now().After(s.ExpiresAt.Add(-30 * time.Second))
}

type Student struct {
    Uid string `json:"uid"`
    Name string `json:"nev"`
    SchoolName string `json:"intezmenyNev"`
    SchoolCode string `json:"intezmenyAzonosito"`
}

type AccountInfo struct {
    ID string `json:"id"`
    Name string `json:"name"`
    Username string `json:"username"`
    InstituteCode string `json:"instituteCode"`
    InstituteName string `json:"instituteName"`
    IsActive bool `json:"isActive"`
}

type StoredAccount struct {
    ID string `json:"id"`
    Name string `json:"name"`
    Username string `json:"username"`
    Institute Institute `json:"institute"`
    AccessToken  string  `json:"accessToken"`
    RefreshToken string  `json:"refreshToken"`
    ExpiresAt time.Time `json:"expiresAt"`
    IsActive bool `json:"isActive"`
}

type LocalProfile struct {
    Nickname  string `json:"nickname"`
    AvatarB64 string `json:"avatarB64"`
}

type StudentDetail struct {
    UID string `json:"uid"`
    Name string `json:"name"`
    BirthName string `json:"birthName"`
    BirthPlace string `json:"birthPlace"`
    BirthDate string `json:"birthDate"`
    MothersName string `json:"mothersName"`
    Email string `json:"email"`
    Phone string `json:"phone"`
    Address string `json:"address"`
    InstituteName string `json:"instituteName"`
    InstituteCode string `json:"instituteCode"`
    GradeDelay int `json:"gradeDelay"`
}

type Grade struct {
    UID string `json:"uid"`
    Date string `json:"date"`
    WriteDate string `json:"writeDate"`
    SubjectUID string `json:"subjectUid"`
    SubjectName string `json:"subjectName"`
    Value int `json:"value"`
    ValueText string `json:"valueText"`
    Weight int `json:"weight"`
    Topic string `json:"topic"`
    Teacher string `json:"teacher"`
    TypeUID string `json:"typeUid"`
    TypeName string `json:"typeName"`
    IsPercentage bool `json:"isPercentage"`
}

type Lesson struct {
    UID string `json:"uid"`
    Date string `json:"date"`
    Start string `json:"start"`
    End string `json:"end"`
    PeriodIndex int `json:"periodIndex"`
    SubjectUID string `json:"subjectUid"`
    SubjectName string `json:"subjectName"`
    Teacher string `json:"teacher"`
    SubstituteTeacher string `json:"substituteTeacher"`
    Room string `json:"room"`
    Description string `json:"description"`
    Name string `json:"name"`
    StatusName string `json:"statusName"`
    IsCancelled bool `json:"isCancelled"`
    IsOnline bool `json:"isOnline"`
    HomeworkUID string `json:"homeworkUid"`
    GroupName string `json:"groupName"`
    YearIndex int `json:"yearIndex"`
}

type Homework struct {
    UID string `json:"uid"`
    Date string `json:"date"`
    LessonDate  string `json:"lessonDate"`
    Deadline string `json:"deadline"`
    Content string `json:"content"`
    SubjectUID string `json:"subjectUid"`
    SubjectName string `json:"subjectName"`
    Teacher string `json:"teacher"`
}

type Absence struct {
    UID string `json:"uid"`
    Date string `json:"date"`
    SubjectUID  string `json:"subjectUid"`
    SubjectName string `json:"subjectName"`
    IsJustified bool `json:"isJustified"`
    TypeName string `json:"typeName"`
}

type Exam struct {
    UID string `json:"uid"`
    Date string `json:"date"`
    SubjectUID string `json:"subjectUid"`
    SubjectName string `json:"subjectName"`
    TypeUID string `json:"typeUid"`
    TypeName string `json:"typeName"`
    Description string `json:"description"`
    Teacher string `json:"teacher"`
}

type Notification struct {
    ID int64 `json:"id"`
    Type string `json:"type"`
    Content string `json:"content"`
    Timestamp string `json:"timestamp"`
    IsRead bool `json:"isRead"`
}

type Countdown struct {
    ID int64 `json:"id"`
    Label string `json:"label"`
    TargetDate string `json:"targetDate"`
    Visible bool `json:"visible"`
    DaysRemaining int `json:"daysRemaining"`
}

type TeacherProfile struct {
    Name string `json:"name"`
    Subjects []string `json:"subjects"`
    AverageGrade float64 `json:"averageGrade"`
    GradeDistribution map[int]int `json:"gradeDistribution"`
    TotalGrades int `json:"totalGrades"`
}

type Change struct {
    Type string `json:"type"`
    Content string `json:"content"`
    Timestamp string `json:"timestamp"`
}

type SubjectColor struct {
    Subject string `json:"subject"`
    Color string `json:"color"`
}

type SubjectAbsenceStat struct {
    SubjectName string `json:"subjectName"`
    UsedHours int `json:"usedHours"`
    MaxHours int `json:"maxHours"`
}

type BellPeriod struct {
    PeriodIndex int  `json:"periodIndex"`
    Start string `json:"start"`
    End  string `json:"end"`
}

