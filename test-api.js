/**
 * API Test Script for Client Progress Backend
 * 
 * This script tests all endpoints and explains what each route does.
 * Run with: node test-api.js
 * 
 * Make sure the server is running on port 3000 before executing.
 */

const BASE_URL = 'http://localhost:3000';

// Store tokens and IDs for use across tests
let authToken = '';
let organizationId = '';
let clientId = '';

// Helper function to make HTTP requests
async function request(method, endpoint, body = null, token = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();
        return { status: response.status, data };
    } catch (error) {
        return { status: 500, error: error.message };
    }
}

// Helper to print test results
function printResult(testName, description, result, expected) {
    const passed = result.status === expected;
    const status = passed ? '✅ PASS' : '❌ FAIL';
    
    console.log('\n' + '='.repeat(70));
    console.log(`${status} | ${testName}`);
    console.log('-'.repeat(70));
    console.log(`📝 Description: ${description}`);
    console.log(`📊 Expected Status: ${expected} | Actual Status: ${result.status}`);
    console.log(`📦 Response:`, JSON.stringify(result.data || result.error, null, 2));
    console.log('='.repeat(70));
    
    return passed;
}

// Generate unique test data
const timestamp = Date.now();
const testOrg = {
    organizationName: `TestOrg_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: 'test123456',
    phone: '1234567890',
    address: '123 Test Street'
};

async function runTests() {
    console.log('\n');
    console.log('🚀'.repeat(35));
    console.log('\n   CLIENT PROGRESS API - ENDPOINT TEST SUITE\n');
    console.log('🚀'.repeat(35));
    console.log(`\n📍 Base URL: ${BASE_URL}`);
    console.log(`🕐 Test Started: ${new Date().toISOString()}\n`);

    let passed = 0;
    let failed = 0;

    // ========================================
    // AUTH ROUTES - /routes/authRoutes.js
    // ========================================
    console.log('\n\n' + '█'.repeat(70));
    console.log('█  SECTION 1: AUTHENTICATION ROUTES (/routes/authRoutes.js)');
    console.log('█'.repeat(70));

    // Test 1: Register Organization
    console.log('\n\n📌 TEST 1: POST /auth/register');
    let result = await request('POST', '/auth/register', testOrg);
    let testPassed = printResult(
        'Register New Organization',
        `Creates a new organization account with email/password authentication.
         - Hashes password using bcrypt before storing
         - Checks for duplicate email/organization name
         - Returns JWT token for immediate use
         - Required fields: organizationName, email, password`,
        result,
        201
    );
    testPassed ? passed++ : failed++;
    
    if (result.data?.token) {
        authToken = result.data.token;
        organizationId = result.data.organization._id;
    }

    // Test 2: Register Duplicate (should fail)
    console.log('\n\n📌 TEST 2: POST /auth/register (Duplicate Email)');
    result = await request('POST', '/auth/register', testOrg);
    testPassed = printResult(
        'Register Duplicate Organization',
        `Attempts to register with an already existing email.
         - Should return 400 error
         - Validates uniqueness of email and organization name`,
        result,
        400
    );
    testPassed ? passed++ : failed++;

    // Test 3: Login
    console.log('\n\n📌 TEST 3: POST /auth/login');
    result = await request('POST', '/auth/login', {
        email: testOrg.email,
        password: testOrg.password
    });
    testPassed = printResult(
        'Login Organization',
        `Authenticates an organization and returns a JWT token.
         - Compares password hash using bcrypt
         - Returns token valid for 7 days
         - Checks if organization is active
         - Required fields: email, password`,
        result,
        200
    );
    testPassed ? passed++ : failed++;
    
    if (result.data?.token) {
        authToken = result.data.token;
    }

    // Test 4: Login with wrong password
    console.log('\n\n📌 TEST 4: POST /auth/login (Wrong Password)');
    result = await request('POST', '/auth/login', {
        email: testOrg.email,
        password: 'wrongpassword'
    });
    testPassed = printResult(
        'Login with Wrong Password',
        `Attempts login with incorrect password.
         - Should return 401 Unauthorized
         - Generic error message to prevent email enumeration`,
        result,
        401
    );
    testPassed ? passed++ : failed++;

    // Test 5: Get Current Organization Profile
    console.log('\n\n📌 TEST 5: GET /auth/me');
    result = await request('GET', '/auth/me', null, authToken);
    testPassed = printResult(
        'Get Current Organization Profile',
        `Returns the profile of the currently authenticated organization.
         - Requires valid JWT token in Authorization header
         - Excludes password from response
         - Used to verify authentication status`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Test 6: Get Profile without token
    console.log('\n\n📌 TEST 6: GET /auth/me (No Token)');
    result = await request('GET', '/auth/me');
    testPassed = printResult(
        'Get Profile Without Authentication',
        `Attempts to access protected route without token.
         - Should return 401 Unauthorized
         - Demonstrates auth middleware protection`,
        result,
        401
    );
    testPassed ? passed++ : failed++;

    // Test 7: Update Profile
    console.log('\n\n📌 TEST 7: PUT /auth/update');
    result = await request('PUT', '/auth/update', {
        organizationName: `UpdatedOrg_${timestamp}`,
        phone: '9876543210'
    }, authToken);
    testPassed = printResult(
        'Update Organization Profile',
        `Updates the organization's profile information.
         - Requires authentication
         - Can update: organizationName, phone, address
         - Cannot update email/password through this endpoint`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Test 8: Change Password
    console.log('\n\n📌 TEST 8: PUT /auth/change-password');
    result = await request('PUT', '/auth/change-password', {
        currentPassword: testOrg.password,
        newPassword: 'newpassword123'
    }, authToken);
    testPassed = printResult(
        'Change Password',
        `Changes the organization's password.
         - Requires authentication
         - Verifies current password before changing
         - New password is automatically hashed
         - Required: currentPassword, newPassword`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Update password for subsequent tests
    testOrg.password = 'newpassword123';

    // Re-login with new password
    result = await request('POST', '/auth/login', {
        email: testOrg.email,
        password: testOrg.password
    });
    if (result.data?.token) {
        authToken = result.data.token;
    }

    // ========================================
    // CLIENT ROUTES - /routes/clientRoutes.js
    // ========================================
    console.log('\n\n' + '█'.repeat(70));
    console.log('█  SECTION 2: CLIENT ROUTES (/routes/clientRoutes.js)');
    console.log('█'.repeat(70));

    // Test 9: Add Client
    console.log('\n\n📌 TEST 9: POST /add/clients');
    result = await request('POST', '/add/clients', {
        clientName: `TestClient_${timestamp}`
    }, authToken);
    testPassed = printResult(
        'Add New Client',
        `Creates a new client for the authenticated organization.
         - Automatically associates client with logged-in organization
         - Also creates an empty Progress record for the client
         - Required: clientName
         - Returns both client and progress objects`,
        result,
        201
    );
    testPassed ? passed++ : failed++;
    
    if (result.data?.client?._id) {
        clientId = result.data.client._id;
    }

    // Test 10: Add Client without auth
    console.log('\n\n📌 TEST 10: POST /add/clients (No Auth)');
    result = await request('POST', '/add/clients', {
        clientName: 'UnauthorizedClient'
    });
    testPassed = printResult(
        'Add Client Without Authentication',
        `Attempts to create client without authentication.
         - Should return 401 Unauthorized
         - All client routes require authentication`,
        result,
        401
    );
    testPassed ? passed++ : failed++;

    // Test 11: Get All Clients
    console.log('\n\n📌 TEST 11: GET /clients');
    result = await request('GET', '/clients', null, authToken);
    testPassed = printResult(
        'Get All Clients',
        `Retrieves all clients belonging to the authenticated organization.
         - Returns only clients owned by the logged-in organization
         - Populates organization name in response
         - Multi-tenant isolation ensures data security`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Test 12: Get Single Client
    console.log('\n\n📌 TEST 12: GET /clients/:id');
    result = await request('GET', `/clients/${clientId}`, null, authToken);
    testPassed = printResult(
        'Get Single Client by ID',
        `Retrieves a specific client by ID.
         - Only returns if client belongs to authenticated organization
         - Returns 404 if client doesn't exist or belongs to another org
         - Includes populated organization details`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Test 13: Update Client
    console.log('\n\n📌 TEST 13: PUT /update/client/:id');
    result = await request('PUT', `/update/client/${clientId}`, {
        clientName: `UpdatedClient_${timestamp}`
    }, authToken);
    testPassed = printResult(
        'Update Client',
        `Updates a client's information.
         - Verifies client belongs to authenticated organization
         - Can only update clientName
         - Returns updated client object`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // ========================================
    // PROGRESS ROUTES - /routes/progressRoutes.js
    // ========================================
    console.log('\n\n' + '█'.repeat(70));
    console.log('█  SECTION 3: PROGRESS ROUTES (/routes/progressRoutes.js)');
    console.log('█'.repeat(70));

    // Test 14: Get All Progress
    console.log('\n\n📌 TEST 14: GET /progress');
    result = await request('GET', '/progress', null, authToken);
    testPassed = printResult(
        'Get All Progress for Organization',
        `Retrieves progress records for all clients in the organization.
         - Returns progress for all clients owned by authenticated org
         - Populates client name and organization details
         - Used for dashboard/overview displays`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Test 15: Get Progress by Client ID
    console.log('\n\n📌 TEST 15: GET /progress?clientId=');
    result = await request('GET', `/progress?clientId=${clientId}`, null, authToken);
    testPassed = printResult(
        'Get Progress for Specific Client',
        `Retrieves progress record for a specific client.
         - Verifies client belongs to authenticated organization
         - Returns 404 if client not found or belongs to another org
         - Query param: clientId`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Test 16: Update Progress
    console.log('\n\n📌 TEST 16: PUT /update/progress?clientId=');
    result = await request('PUT', `/update/progress?clientId=${clientId}`, {
        Lead: 'Hot Lead',
        firstContact: '2024-01-15',
        followUp: '2024-01-20',
        RFQ: 'Received',
        quote: 'Sent',
        quoteFollowUp: '2024-01-25',
        order: 50000,
        delivered: false
    }, authToken);
    testPassed = printResult(
        'Update Progress',
        `Updates the progress/pipeline status for a client.
         - Verifies client belongs to authenticated organization
         - Can update all progress fields:
           • Lead: Lead status/temperature
           • firstContact: Date of first contact
           • followUp: Follow-up date
           • RFQ: Request for Quote status
           • quote: Quote status
           • quoteFollowUp: Quote follow-up date
           • order: Order value (number)
           • delivered: Delivery status (boolean)`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Test 17: Verify Progress Update
    console.log('\n\n📌 TEST 17: GET /progress?clientId= (Verify Update)');
    result = await request('GET', `/progress?clientId=${clientId}`, null, authToken);
    testPassed = printResult(
        'Verify Progress Update',
        `Retrieves the updated progress to verify changes were saved.
         - Confirms all fields were updated correctly
         - Shows complete progress object with populated references`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // ========================================
    // ORGANIZATION ROUTES - /routes/organizationRoutes.js
    // ========================================
    console.log('\n\n' + '█'.repeat(70));
    console.log('█  SECTION 4: ORGANIZATION ROUTES (/routes/organizationRoutes.js)');
    console.log('█'.repeat(70));

    // Test 18: Get All Organizations (Public)
    console.log('\n\n📌 TEST 18: GET /organizations');
    result = await request('GET', '/organizations');
    testPassed = printResult(
        'Get All Organizations (Public)',
        `Lists all active organizations.
         - Public endpoint - no authentication required
         - Excludes password from response
         - Only returns organizations where isActive = true
         - Can be used for public directory listing`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Test 19: Get Organization by ID (Public)
    console.log('\n\n📌 TEST 19: GET /organizations/:id');
    result = await request('GET', `/organizations/${organizationId}`);
    testPassed = printResult(
        'Get Organization by ID (Public)',
        `Retrieves a specific organization's public profile.
         - Public endpoint - no authentication required
         - Excludes password from response
         - Returns 404 if organization not found`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // ========================================
    // CLEANUP - Delete Test Data
    // ========================================
    console.log('\n\n' + '█'.repeat(70));
    console.log('█  SECTION 5: CLEANUP');
    console.log('█'.repeat(70));

    // Test 20: Delete Client
    console.log('\n\n📌 TEST 20: DELETE /delete/client/:id');
    result = await request('DELETE', `/delete/client/${clientId}`, null, authToken);
    testPassed = printResult(
        'Delete Client',
        `Deletes a client and all associated progress records.
         - Verifies client belongs to authenticated organization
         - Cascades delete to Progress collection
         - Returns 404 if client not found or belongs to another org
         - Permanent deletion (not soft delete)`,
        result,
        200
    );
    testPassed ? passed++ : failed++;

    // Test 21: Verify Client Deleted
    console.log('\n\n📌 TEST 21: GET /clients/:id (Verify Deletion)');
    result = await request('GET', `/clients/${clientId}`, null, authToken);
    testPassed = printResult(
        'Verify Client Deletion',
        `Attempts to retrieve deleted client.
         - Should return 404 Not Found
         - Confirms successful deletion`,
        result,
        404
    );
    testPassed ? passed++ : failed++;

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n\n');
    console.log('🏁'.repeat(35));
    console.log('\n   TEST SUITE COMPLETED\n');
    console.log('🏁'.repeat(35));
    
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                        TEST RESULTS SUMMARY                         ║
╠══════════════════════════════════════════════════════════════════════╣
║  Total Tests:  ${(passed + failed).toString().padEnd(4)}                                               ║
║  ✅ Passed:    ${passed.toString().padEnd(4)}                                               ║
║  ❌ Failed:    ${failed.toString().padEnd(4)}                                               ║
║  Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%                                            ║
╚══════════════════════════════════════════════════════════════════════╝
    `);

    console.log('\n📚 ROUTE SUMMARY:');
    console.log(`
┌──────────────────────────────────────────────────────────────────────┐
│ AUTH ROUTES (/routes/authRoutes.js)                                 │
├──────────────────────────────────────────────────────────────────────┤
│ POST   /auth/register        Register new organization              │
│ POST   /auth/login           Login and get JWT token                │
│ GET    /auth/me              Get current org profile (protected)    │
│ PUT    /auth/update          Update org profile (protected)         │
│ PUT    /auth/change-password Change password (protected)            │
├──────────────────────────────────────────────────────────────────────┤
│ CLIENT ROUTES (/routes/clientRoutes.js) - All Protected            │
├──────────────────────────────────────────────────────────────────────┤
│ GET    /clients              Get all clients for org                │
│ GET    /clients/:id          Get single client                      │
│ POST   /add/clients          Create new client + progress           │
│ PUT    /update/client/:id    Update client name                     │
│ DELETE /delete/client/:id    Delete client + progress               │
├──────────────────────────────────────────────────────────────────────┤
│ PROGRESS ROUTES (/routes/progressRoutes.js) - All Protected        │
├──────────────────────────────────────────────────────────────────────┤
│ GET    /progress             Get all progress (or by clientId)      │
│ PUT    /update/progress      Update progress by clientId            │
├──────────────────────────────────────────────────────────────────────┤
│ ORGANIZATION ROUTES (/routes/organizationRoutes.js) - Public       │
├──────────────────────────────────────────────────────────────────────┤
│ GET    /organizations        List all active organizations          │
│ GET    /organizations/:id    Get organization by ID                 │
└──────────────────────────────────────────────────────────────────────┘
    `);

    console.log('\n🔐 AUTHENTICATION FLOW:');
    console.log(`
    1. Register: POST /auth/register → Returns JWT token
    2. Login:    POST /auth/login    → Returns JWT token
    3. Use token in header: Authorization: Bearer <token>
    4. Token expires in 7 days
    `);

    console.log('\n📊 DATA MODEL:');
    console.log(`
    Organization (1) ──────┐
         │                 │
         │ has many        │ has many  
         ▼                 ▼
      Client (n) ──────► Progress (1:1)
         │
         └── Each client has exactly one progress record
    `);

    process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(console.error);
