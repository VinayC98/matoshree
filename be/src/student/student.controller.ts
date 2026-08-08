import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { StudentService } from './student.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';

@ApiTags('Students')
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Student created successfully' })
  async create(@Body() dto: CreateStudentDto) {
    return this.studentService.createStudent(dto);
  }

  // @Get()
  // @ApiOkResponse({ description: 'List of students' })
  // async findAll() {
  //   return this.studentService.getAllStudents();
  // }

  @Get(':id')
  @ApiOkResponse({ description: 'Student details' })
  async findOne(@Param('id') id: string) {
    return this.studentService.getStudentById(id);
  }

  @Get()
  async getStudents(@Query('page') page = '1', @Query('limit') limit = '20') {
    console.log('something');
    return this.studentService.getLatestStudents(page, limit);
  }

  @Get(':id/details')
  getStudentDetails(@Param('id') id: string) {
    return this.studentService.getStudentDetails(id);
  }
}
