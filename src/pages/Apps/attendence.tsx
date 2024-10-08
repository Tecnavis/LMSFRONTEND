import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, Paper, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css'; // Import calendar styles
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import axios from 'axios';
import { fetchStudents, BASE_URL } from '../Helper/handle-api';
import HolidayForm from './holidayform';

interface AttendanceRecord {
    date: string;
    status: 'Present' | 'Absent';
}

interface Student {
    _id: number;
    active: boolean;
    name: string;
    courseName: string;
    present: boolean;
    attendanceHistory?: AttendanceRecord[];
}

interface AttendanceRequest {
    students: number;
    date: string;
    status: 'Present' | 'Absent';
}

const localizer = momentLocalizer(moment);

const AttendanceTable: React.FC = () => {
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [currentDate, setCurrentDate] = useState<string>(moment().format('YYYY-MM-DD'));
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStudentAttendance, setSelectedStudentAttendance] = useState<AttendanceRecord[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, [currentDate]);

    useEffect(() => {
        if (selectedStudent?._id) {
            loadSpecificStudentAttendance(selectedStudent._id);
        }
    }, [selectedStudent?._id]);

    const loadData = async () => {
        const token = localStorage.getItem('token');
        axios.defaults.headers.common['Authorization'] = token;
        try {
            setLoading(true);
            let page = 1;
            const limit = 2000;
            let allFetchedStudents: Student[] = [];
            let hasMore = true;
    
            while (hasMore) {
                const response = await fetchStudents(page, limit);
                const students = response.students || [];
                allFetchedStudents = allFetchedStudents.concat(students);
    
                // Check if there's more data to fetch
                hasMore = students.length === limit;
                page += 1;
            }
    
            setAllStudents(
                allFetchedStudents.map((student: any) => ({
                    ...student,
                    attendanceHistory: student.attendanceHistory || [],
                }))
            );
        } catch (error) {
            console.error('Error fetching student details:', error);
            setError('Failed to load student data');
        } finally {
            setLoading(false);
        }
    };
    
    const [selectAll, setSelectAll] = useState<boolean>(false);

    const loadSpecificStudentAttendance = async (studentId: number) => {
        try {
            const response = await axios.get(`${BASE_URL}/attendance/student/${studentId}`);
            setSelectedStudentAttendance(response.data);

            setSelectedStudent((prevStudent) => {
                if (!prevStudent) return null; // Handle the case where prevStudent is null

                return {
                    ...prevStudent,
                    attendanceHistory: response.data,
                    _id: prevStudent._id, // Ensure _id is retained from prevStudent
                    name: prevStudent.name,
                    courseName: prevStudent.courseName,
                    present: prevStudent.present,
                };
            });
        } catch (error) {
            console.error('Error fetching attendance records:', error);
            setError('Failed to load attendance records');
        }
    };

    const handleAttendanceChange = async (id: number) => {
        try {
            const updatedStudent = allStudents.find((student) => student._id === id);
            if (!updatedStudent) return;

            const attendanceHistory = updatedStudent.attendanceHistory || [];
            const attendanceIndex = attendanceHistory.findIndex((record) => record.date === currentDate);
            let newStatus: 'Present' | 'Absent' = 'Present';
            if (attendanceIndex !== undefined && attendanceIndex !== -1) {
                newStatus = attendanceHistory[attendanceIndex].status === 'Present' ? 'Absent' : 'Present';
            }

            const updatedAttendanceHistory =
                attendanceIndex !== undefined && attendanceIndex !== -1
                    ? [...attendanceHistory.slice(0, attendanceIndex), { ...attendanceHistory[attendanceIndex], status: newStatus }, ...attendanceHistory.slice(attendanceIndex + 1)]
                    : [
                          ...attendanceHistory,
                          {
                              date: currentDate,
                              status: newStatus,
                          },
                      ];

            const requestData: AttendanceRequest = {
                students: id,
                date: currentDate,
                status: newStatus,
            };

            const response = await axios.post(`${BASE_URL}/attendance`, requestData);
            if (response.status === 200) {
                setAllStudents((prevStudents) =>
                    prevStudents.map((student) =>
                        student._id === id
                            ? {
                                  ...student,
                                  present: newStatus === 'Present',
                                  attendanceHistory: updatedAttendanceHistory,
                              }
                            : student
                    )
                );
                if (selectedStudent && selectedStudent._id === id) {
                    setSelectedStudent({
                        ...selectedStudent,
                        attendanceHistory: updatedAttendanceHistory,
                    });
                }
            } else {
                console.error('Failed to save attendance');
            }
        } catch (error) {
            console.error('Error saving attendance:', error);
        }
    };

    const handleViewClick = (student: Student) => {
        setSelectedStudent(student);
    };

    const handleClose = () => {
        setSelectedStudent(null);
    };

    const handlePreviousDay = () => {
        setCurrentDate(moment(currentDate).subtract(1, 'days').format('YYYY-MM-DD'));
    };

    const handleNextDay = () => {
        setCurrentDate(moment(currentDate).add(1, 'days').format('YYYY-MM-DD'));
    };

    const getCalendarEvents = (attendanceHistory: AttendanceRecord[]) => {
        return attendanceHistory.map((record) => ({
            title: record.status === 'Present' ? 'Present' : record.status === 'Absent' ? 'Absent' : 'Holiday',
            start: new Date(record.date),
            end: new Date(record.date),
            allDay: true,
            style: {
                backgroundColor: record.status === 'Present' ? '#4caf50' : record.status === 'Absent' ? '#f44336' : '#ff9800', // Set holiday color
            },
        }));
    };

    const filteredStudents = allStudents.map((student) => ({
        ...student,
        present: student.attendanceHistory?.some((record) => record.date === currentDate && record.status === 'Present') || false,
    }));

    if (loading) return <Typography>Loading...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;

    const handleClick = () => {
        window.location.href = '/apps/monthlyattendence';
    };


    const handleSelectAllChange = async () => {
        try {
            // Determine the new status based on the current state
            const newStatus: 'Present' | 'Absent' = selectAll ? 'Absent' : 'Present';
    
            // Update each student's status
            await Promise.all(
                allStudents.map(async (student) => {
                    const attendanceHistory = student.attendanceHistory || [];
                    const attendanceIndex = attendanceHistory.findIndex((record) => record.date === currentDate);
                    const updatedAttendanceHistory =
                        attendanceIndex !== undefined && attendanceIndex !== -1
                            ? [...attendanceHistory.slice(0, attendanceIndex), { ...attendanceHistory[attendanceIndex], status: newStatus }, ...attendanceHistory.slice(attendanceIndex + 1)]
                            : [
                                  ...attendanceHistory,
                                  {
                                      date: currentDate,
                                      status: newStatus,
                                  },
                              ];
    
                    const requestData: AttendanceRequest = {
                        students: student._id,
                        date: currentDate,
                        status: newStatus,
                    };
    
                    await axios.post(`${BASE_URL}/attendance`, requestData);
    
                    // Update local state
                    setAllStudents((prevStudents) =>
                        prevStudents.map((s) =>
                            s._id === student._id
                                ? {
                                      ...s,
                                      present: newStatus === 'Present',
                                      attendanceHistory: updatedAttendanceHistory,
                                  }
                                : s
                        )
                    );
                })
            );
    
            // Update select all state
            setSelectAll(!selectAll);
        } catch (error) {
            console.error('Error updating attendance status for all students:', error);
        }
    };
    
    // const fetchAttendanceRecords = async () => {}
    return (
        <Paper elevation={3} sx={{ padding: 3 }}>
            <Typography variant="h6" gutterBottom style={{ display: 'flex' }}>
                <Button variant="contained" color="primary" onClick={handleClick}>
                    Monthly Attendance
                </Button>
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <IconButton onClick={handlePreviousDay}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6">{moment(currentDate).format('MMMM Do YYYY')}</Typography>
                <IconButton onClick={handleNextDay}>
                    <ArrowForwardIcon />
                </IconButton>
            </div>

            <TableContainer>
                <Table>
                <TableHead>
    <TableRow>
        <TableCell>
            <Checkbox
                checked={selectAll}
                onChange={handleSelectAllChange}
            />
        </TableCell>
        <TableCell>No.</TableCell>
        <TableCell>Name</TableCell>
        <TableCell>Course</TableCell>
        <TableCell align="center">Present</TableCell>
        <TableCell align="center">View</TableCell>
    </TableRow>
</TableHead>

                    <TableBody>
    {filteredStudents
        .filter((student) => student.active)
        .map((student, index) => (
            <TableRow key={student._id}>
                <TableCell>
                    <Checkbox
                        checked={student.present}
                        onChange={() => handleAttendanceChange(student._id)}
                    />
                </TableCell>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{student.name}</TableCell>
                <TableCell>{student.courseName}</TableCell>
                <TableCell align="center">
                    <Checkbox
                        checked={student.present}
                        onChange={() => handleAttendanceChange(student._id)}
                    />
                </TableCell>
                <TableCell align="center">
                    <Button variant="contained" onClick={() => handleViewClick(student)}>
                        View
                    </Button>
                </TableCell>
            </TableRow>
        ))}
</TableBody>

                </Table>
            </TableContainer>

            <Dialog open={Boolean(selectedStudent)} onClose={handleClose}>
                <DialogTitle>{selectedStudent?.name}</DialogTitle>
                <DialogContent>
                    <Calendar
                        localizer={localizer}
                        events={getCalendarEvents(selectedStudent?.attendanceHistory || [])}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: 500, width: '100%' }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} color="primary">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default AttendanceTable;