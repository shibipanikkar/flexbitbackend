const express = require("express");
const bodyParser = require("body-parser");
const sql = require("mssql");
let cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Database configuration
const config = {
  user: "flexbitdbadmin",
  password: "Sape2020",
  server: "flexbit-dbserver.database.windows.net",
  database: "Flexbit-SQLDB",
  options: {
    encrypt: true, // For secure connection
  },
};

app.post("/api/getflexbitmeByDomain", async (req, res) => {
  try {
    console.log("Commecting SQL Server");
    const pool = await sql.connect(config);
    console.log("SQL Server Connected");
    const { domain } = req.body;
    console.log(" Domain: " + domain);

    const finalURL = await pool
      .request()
      .input("domain", sql.VarChar, domain)      
      .query(
        "select targeturl from Flexbit_Domain_Mappings where domainname = @domain"
      );
    if (finalURL.recordset.length > 0) {
      const outtargetURL = finalURL.recordset[0].targeturl;
      console.log(outtargetURL);
      res.json({ myurl: outtargetURL, message: "SuccessfullyFetched" });      
    } else {
      res.json({ message: "InvalidFetch" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    await sql.close();
  }
});

// API endpoint for creating domains
app.post("/api/getflexbitmBySubDomain", async (req, res) => {
  try {
    console.log("Commecting SQL Server");
    const pool = await sql.connect(config);
    console.log("SQL Server Connected");
    const { domain, subdomain } = req.body;
    console.log(" Domain: " + domain + " SubDomain:  " + subdomain);
    
      const finalURL = await pool
        .request()
        .input("domain", sql.VarChar, domain)
        .input("subdomain", sql.VarChar, subdomain)
        .query(
          "select targeturl from Flexbit_SubDomain_Mappings where domainname = @domain and subdomainname = @subdomain"
        );

      if (finalURL.recordset.length > 0) {
        const outtargetURL = finalURL.recordset[0].targeturl;
        res.json({ myurl: outtargetURL, message: "SuccessfullyFetched" });
      } else {
        res.json({ message: "InvalidFetch" });
      }
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    await sql.close();
  }
});

// API endpoint for creating domains
app.post("/api/flexbitme", async (req, res) => {
  let isDomainExistsForUser = false;
  let isSubDomainExists = false;
  let domaintaken = false;

  try {
    console.log("Commecting SQL Server");
    const pool = await sql.connect(config);
    console.log("SQL Server Connected");
    const { email, domain, subDomain, targetURL } = req.body;
    let domainTarget = "";
    let subDomainTarget = "";
    if (subDomain === "") {
      domainTarget = targetURL;
    } else {
      subDomainTarget = targetURL;
      domainTarget = targetURL;
    }
    console.log("calling SQL");
    console.log(
      "Email: " +
        email +
        " Domain: " +
        domain +
        " SubDomain:  " +
        subDomain +
        " TargetURL:  " +
        targetURL
    );

    //Check if the Domain Belongs to the User
    const isDomainPresent = await pool
      .request()
      .input("email", sql.VarChar, email)
      .input("domain", sql.VarChar, domain)
      .query(
        "select top 1 domainname from  Flexbit_Domain_Mappings where domainname = @domain and email = @email"
      );

    if (isDomainPresent.recordset.length > 0) {
      isDomainExistsForUser = true;
      console.log("Domian Exists for user");
      if (subDomain === "") {
        res.json({ email, domain, message: "DomainExistsUser" });
      } else {
        const isSubDomainPresent = await pool
          .request()
          .input("email", sql.VarChar, email)
          .input("domain", sql.VarChar, domain)
          .input("subdomain", sql.VarChar, subDomain)
          .query(
            "select top 1 domainname from  Flexbit_SubDomain_Mappings where domainname = @domain and email = @email and subdomainname = @subdomain"
          );

        if (isSubDomainPresent.recordset.length > 0) {
          res.json({
            email,
            domain,
            subDomain,
            message: "SubDomainExistsUser",
          });
        } else {
          const registerSubDomain = await pool
            .request()
            .input("subdomain", sql.VarChar, subDomain)
            .input("domain", sql.VarChar, domain)
            .input("targeturl", sql.VarChar, subDomainTarget)
            .input("email", sql.VarChar, email)
            .query(
              "insert into Flexbit_SubDomain_Mappings(subdomainname, domainname, targeturl, email, created_date, modified_date) values (@subdomain, @domain, @targeturl, @email, GetDate(), GetDate())"
            );
          console.log("Created Sub Domain and mapped " + subDomain);
          res.json({ email, domain, subDomain, message: "SubDomainCreated" });
        }
      }
    } else {
      //If domain doesn't belong to the user, check if the domain is already been taken
      const isDomainTaken = await pool
        .request()
        .input("email", sql.VarChar, email)
        .input("domain", sql.VarChar, domain)
        .query(
          "select top 1 domainname from  Flexbit_Domain_Mappings where domainname = @domain"
        );

      if (isDomainTaken.recordset.length > 0) {
        domaintaken = true;
        console.log("Domian already taken by others");
        res.json({ email, domain, message: "DomainTaken" });
        //Send the result back saying Domain is taken.Select another domain
      } else {
        //Domain is not taken by anyone, so craete for the user
        const registerDomain = await pool
          .request()
          .input("domain", sql.VarChar, domain)
          .input("targeturl", sql.VarChar, domainTarget)
          .input("email", sql.VarChar, email)
          .query(
            "insert into Flexbit_Domain_Mappings(domainname, targeturl, email, created_date, modified_date) values (@domain, @targeturl, @email, GetDate(), GetDate())"
          );
        console.log("Created Domain and mapped " + domain);
        res.json({ email, domain, message: "DomainCreated" });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    await sql.close();
  }
});

// API endpoint for user signup
app.post("/api/signin", async (req, res) => {
  try {
    console.log("Commecting SQL Server");
    const pool = await sql.connect(config);
    console.log("SQL Server Connected");
    const { email, password, fullname } = req.body;
    console.log("calling SQL");
    console.log(
      "Email: " + email + " Password: " + password + " FullName:  " + fullname
    );
    let outEmail = "";
    let exitingUser = false;
    //check if the user exists
    const isNewUser = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("select top 1 email from  Flexbit_Users where email = @email");

    if (isNewUser.recordset.length > 0) {
      outEmail = isNewUser.recordset[0].email;
      exitingUser = true;
    }
    //check if the user credentials are good
    if (exitingUser) {
      const authenticate = await pool
        .request()
        .input("email", sql.VarChar, email)
        .input("password", sql.VarChar, password)
        .query(
          "select email, fullname, password from  Flexbit_Users where email = @email and password = @password"
        );

      if (authenticate.recordset.length > 0) {
        const fullname = authenticate.recordset[0].fullname;
        res.json({ email, fullname, message: "LoggedIn" });
      } else {
        res.json({ email, fullname, message: "AuthFailed" });
      }

      console.log(authenticate);
    } else {
      if (fullname === null || fullname === "") {
        res.json({ email, fullname, message: "NewUserNoFN" });
      } else {
        const registerUser = await pool
          .request()
          .input("email", sql.VarChar, email)
          .input("fullname", sql.VarChar, fullname)
          .input("password", sql.VarChar, password)
          .query(
            "insert into Flexbit_Users(email, fullname, password, created_date, modified_date) values (@email, @fullname, @password, GetDate(), GetDate())"
          );
        res.json({ email, fullname, message: "UserCreated" });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    await sql.close();
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});