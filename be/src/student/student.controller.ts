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

  @Get('options')
  async getStudentOptions(
    @Query('search') search = '',
    @Query('limit') limit = '10',
    @Query('hasActiveMembership')
    hasActiveMembership?: string,
  ) {
    return this.studentService.searchStudentOptions({
      search,
      limit,
      hasActiveMembership,
    });
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Student details' })
  async findOne(@Param('id') id: string) {
    return this.studentService.getStudentById(id);
  }

  @Get()
  async getStudents(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search = '',
  ) {
    return this.studentService.getStudents(page, limit, search);
  }

  @Get(':id/details')
  getStudentDetails(@Param('id') id: string) {
    return this.studentService.getStudentDetails(id);
  }
}
