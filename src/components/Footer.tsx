import React from 'react';

const Footer = () => {
    return (
      <footer className="bg-muted/50 mt-auto">
        <div className="wrapper px-3 py-7 flex flex-col md:flex-row md:items-center">
          <div className="w-fit md:w-1/6">
            <h2 className="text-2xl font-bold mb-4">QCI</h2>
          </div>

          <div className="w-full px-10 lg:px-6 md:px-0">
            <p className="w-full  mb-4">
              Qi Dao Community Ideas (QCI) describe suggestions for improvements to the Qi Dao platform, including core protocol
              specifications, client APIs, and contract standards.
            </p>
          </div>
        </div>
      </footer>
    );
};

export default Footer;
