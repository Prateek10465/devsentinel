// Demo: TypeScript imports for DevSentinel screenshots
// Open this file and hover over the package names to see risk scores

import express from "express";
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import mysql from "mysql2";
import pg from "pg";
import redis from "redis";
import nodemailer from "nodemailer";
import multer from "multer";
import sharp from "sharp";
import socket from "socket.io";

// Try hovering over each import name above!
// DevSentinel will show:
//   - Risk score (0-100)
//   - CVE count  
//   - License info
//   - Latest version
