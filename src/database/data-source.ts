// src/database/data-source.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './typeorm.config';

const AppDataSource = new DataSource(dataSourceOptions());

export default AppDataSource;
